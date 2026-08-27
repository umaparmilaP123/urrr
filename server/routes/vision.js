'use strict';
/**
 * routes/vision.js
 *
 * POST /api/vision/analyze-hazard
 *   - Accepts: { imageBase64: "<data url or raw base64>" }
 *   - Proxies to Gemini Vision API using server-side GEMINI_API_KEY
 *   - Rate-limited to 5 requests / minute per IP
 *   - Returns same JSON shape as the old client-side analyzeHazardImage.js:
 *       { hazard_category, estimated_water_level_ft, urgency_level,
 *         confidence_score, incident_title, reasoning }
 *   - On error returns { error, code } with the same error codes:
 *       NO_KEY | API_ERROR | PARSE_ERROR | SCHEMA_ERROR
 */

const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const router = Router();

// ── Rate limiter (5 req / min per IP) ─────────────────────────────────────
const visionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many vision requests. Please wait a moment and try again.', code: 'RATE_LIMITED' },
});

// ── Constants ──────────────────────────────────────────────────────────────
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const VALID_CATEGORIES = ['Electricity', 'Flooding', 'Infrastructure', 'Tree Fall'];
const VALID_URGENCIES  = ['CRITICAL', 'MEDIUM', 'LOW'];

const SYSTEM_PROMPT = `You are an AI analyst embedded in the UrbanGuard monsoon hazard reporting system for GHMC (Hyderabad Municipal Corporation). Analyze field photographs taken during urban flooding events and return a machine-readable hazard assessment.

RESPOND ONLY WITH A SINGLE VALID JSON OBJECT. No markdown fences, no explanation, no trailing text.

ANALYSIS RULES:

1. hazard_category — choose exactly ONE:
   "Electricity"     visible downed/exposed wires, damaged poles, sparking transformers
   "Flooding"        standing water, submerged roads/vehicles/people
   "Infrastructure"  collapsed roads, bridges, retaining walls, potholes, landslides
   "Tree Fall"       fallen or leaning trees, debris blockages
   If multiple hazards are visible, choose the most life-threatening.

2. estimated_water_level_ft — depth in feet using visual markers:
   No water visible       -> 0.0
   Ankle-deep             -> 0.3 to 0.5
   Tire 1/4 submerged     -> 0.5
   Tire half submerged    -> 1.0
   Rim fully submerged    -> 1.5
   Top of wheel submerged -> 2.0 to 2.5
   Hood / bonnet level    -> 3.0 to 3.5
   Roof of car            -> 4.0+
   Use ONE decimal place. Return 0.0 if no water visible.

3. urgency_level:
   "LOW"      water < 1 ft, no immediate danger, minor obstruction
   "MEDIUM"   water 1 to 2.5 ft OR road blocked OR moderate infrastructure damage
   "CRITICAL" water > 2.5 ft OR exposed live electricity near water OR structural collapse OR imminent life threat

4. confidence_score — float 0.00 to 1.00:
   0.85 to 1.00  Clear, unambiguous visual markers
   0.60 to 0.84  Some ambiguity (partial view, low light, partial submersion)
   0.30 to 0.59  Hard to determine (poor image quality or unusual angle)
   0.00 to 0.29  Cannot assess reliably (blank, irrelevant, or corrupt image)

5. incident_title — max 12 words, concise, specific to visible hazard.

6. reasoning — 2 to 3 sentences. State which visual markers you identified,
   how you estimated water depth, and why you chose that urgency level.
   Written for municipal emergency responders.

OUTPUT FORMAT (strict, no deviation):
{
  "hazard_category": "Electricity|Flooding|Infrastructure|Tree Fall",
  "estimated_water_level_ft": 0.0,
  "urgency_level": "CRITICAL|MEDIUM|LOW",
  "confidence_score": 0.00,
  "incident_title": "short title here",
  "reasoning": "2-3 sentence explanation here"
}`;

// ── Validation ─────────────────────────────────────────────────────────────
function validateResult(obj) {
  const errors = [];
  if (!VALID_CATEGORIES.includes(obj.hazard_category))
    errors.push(`hazard_category must be one of [${VALID_CATEGORIES.join(', ')}], got "${obj.hazard_category}"`);
  if (typeof obj.estimated_water_level_ft !== 'number' || obj.estimated_water_level_ft < 0)
    errors.push(`estimated_water_level_ft must be a non-negative number`);
  if (!VALID_URGENCIES.includes(obj.urgency_level))
    errors.push(`urgency_level must be one of [${VALID_URGENCIES.join(', ')}]`);
  if (typeof obj.confidence_score !== 'number' || obj.confidence_score < 0 || obj.confidence_score > 1)
    errors.push('confidence_score must be a float between 0 and 1');
  if (typeof obj.incident_title !== 'string' || !obj.incident_title.trim())
    errors.push('incident_title must be a non-empty string');
  if (typeof obj.reasoning !== 'string' || !obj.reasoning.trim())
    errors.push('reasoning must be a non-empty string');
  return errors;
}

// ── Route ──────────────────────────────────────────────────────────────────
router.post('/', visionLimiter, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(503).json({ error: 'Gemini API key not configured on server.', code: 'NO_KEY' });
  }

  const { imageBase64 } = req.body;
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'imageBase64 is required', code: 'API_ERROR' });
  }

  const rawBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // Call Gemini
  let response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_PROMPT },
            { inline_data: { mime_type: 'image/jpeg', data: rawBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512, topP: 0.8 },
      }),
    });
  } catch (networkErr) {
    return res.status(502).json({
      error: `Network error reaching Gemini API: ${networkErr.message}`,
      code: 'API_ERROR',
    });
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try { const b = await response.json(); detail = b?.error?.message || detail; } catch { /**/ }
    return res.status(502).json({ error: `Gemini API error: ${detail}`, code: 'API_ERROR' });
  }

  // Extract model text
  let rawText = '';
  try {
    const data = await response.json();
    rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } catch {
    return res.status(502).json({ error: 'Failed to parse Gemini response body.', code: 'PARSE_ERROR' });
  }

  if (!rawText.trim()) {
    return res.status(502).json({ error: 'Gemini returned an empty response.', code: 'PARSE_ERROR' });
  }

  // Extract JSON (model sometimes wraps in backtick fences)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return res.status(502).json({
      error: `Model response contained no JSON. Raw: "${rawText.slice(0, 200)}"`,
      code: 'PARSE_ERROR',
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (jsonErr) {
    return res.status(502).json({ error: `JSON.parse failed: ${jsonErr.message}`, code: 'PARSE_ERROR' });
  }

  const validationErrors = validateResult(parsed);
  if (validationErrors.length > 0) {
    return res.status(502).json({
      error: `AI response failed schema validation: ${validationErrors.join('; ')}`,
      code: 'SCHEMA_ERROR',
    });
  }

  // Normalise numeric precision
  parsed.estimated_water_level_ft = Math.round(parsed.estimated_water_level_ft * 10) / 10;
  parsed.confidence_score         = Math.round(parsed.confidence_score * 100)         / 100;

  res.json(parsed);
});

module.exports = router;
