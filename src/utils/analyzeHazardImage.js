/**
 * analyzeHazardImage.js
 * -----------------------------------------------------------------------------
 * Standalone helper that sends a base64 image to the Gemini 1.5 Flash Vision
 * API and returns a structured hazard analysis object ready to populate UI state.
 *
 * Usage:
 *   import { analyzeHazardImage } from '../utils/analyzeHazardImage';
 *   const result = await analyzeHazardImage(base64DataUrl);
 *
 * Returns:
 *   {
 *     hazard_category:          "Electricity" | "Flooding" | "Infrastructure" | "Tree Fall"
 *     estimated_water_level_ft: number   // e.g. 2.5
 *     urgency_level:            "CRITICAL" | "MEDIUM" | "LOW"
 *     confidence_score:         number   // 0.00 – 1.00
 *     incident_title:           string
 *     reasoning:                string
 *   }
 *
 * Throws errors with a `.code` property:
 *   "NO_KEY"      — VITE_GEMINI_API_KEY not set or is placeholder
 *   "API_ERROR"   — non-2xx response from Gemini, or network failure
 *   "PARSE_ERROR" — response body was not parseable JSON
 *   "SCHEMA_ERROR"— JSON parsed but failed field validation
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const VALID_CATEGORIES = ['Electricity', 'Flooding', 'Infrastructure', 'Tree Fall'];
const VALID_URGENCIES  = ['CRITICAL', 'MEDIUM', 'LOW'];

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateResult(obj) {
  const errors = [];

  if (!VALID_CATEGORIES.includes(obj.hazard_category))
    errors.push(`hazard_category must be one of [${VALID_CATEGORIES.join(', ')}], got "${obj.hazard_category}"`);

  if (typeof obj.estimated_water_level_ft !== 'number' || obj.estimated_water_level_ft < 0)
    errors.push(`estimated_water_level_ft must be a non-negative number, got "${obj.estimated_water_level_ft}"`);

  if (!VALID_URGENCIES.includes(obj.urgency_level))
    errors.push(`urgency_level must be one of [${VALID_URGENCIES.join(', ')}], got "${obj.urgency_level}"`);

  if (typeof obj.confidence_score !== 'number' || obj.confidence_score < 0 || obj.confidence_score > 1)
    errors.push(`confidence_score must be a float between 0 and 1, got "${obj.confidence_score}"`);

  if (typeof obj.incident_title !== 'string' || !obj.incident_title.trim())
    errors.push('incident_title must be a non-empty string');

  if (typeof obj.reasoning !== 'string' || !obj.reasoning.trim())
    errors.push('reasoning must be a non-empty string');

  return errors;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Analyzes a base64-encoded image for urban monsoon hazards using Gemini Vision.
 *
 * @param {string} imageBase64
 *   Full data URL ("data:image/jpeg;base64,...") or raw base64 string.
 *
 * @returns {Promise<{
 *   hazard_category: string,
 *   estimated_water_level_ft: number,
 *   urgency_level: string,
 *   confidence_score: number,
 *   incident_title: string,
 *   reasoning: string
 * }>}
 */
export async function analyzeHazardImage(imageBase64) {
  // 1. API key guard
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    const err = new Error(
      'Gemini API key is not configured. Add VITE_GEMINI_API_KEY to your .env file.'
    );
    err.code = 'NO_KEY';
    throw err;
  }

  // 2. Strip data URL prefix if present
  const rawBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // 3. Call Gemini Vision API
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
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          topP: 0.8,
        },
      }),
    });
  } catch (networkErr) {
    const err = new Error(`Network error reaching Gemini API: ${networkErr.message}`);
    err.code = 'API_ERROR';
    throw err;
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try { const b = await response.json(); detail = b?.error?.message || detail; } catch { /**/ }
    const err = new Error(`Gemini API error: ${detail}`);
    err.code = 'API_ERROR';
    throw err;
  }

  // 4. Extract model text
  let rawText = '';
  try {
    const data = await response.json();
    rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } catch {
    const err = new Error('Failed to parse Gemini API response body.');
    err.code = 'PARSE_ERROR';
    throw err;
  }

  if (!rawText.trim()) {
    const err = new Error('Gemini returned an empty response.');
    err.code = 'PARSE_ERROR';
    throw err;
  }

  // 5. Extract JSON (model sometimes wraps in backtick fences despite instructions)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const err = new Error(`Model response contained no JSON object. Raw output: "${rawText.slice(0, 300)}"`);
    err.code = 'PARSE_ERROR';
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (jsonErr) {
    const err = new Error(`JSON.parse failed: ${jsonErr.message}`);
    err.code = 'PARSE_ERROR';
    throw err;
  }

  // 6. Schema validation
  const validationErrors = validateResult(parsed);
  if (validationErrors.length > 0) {
    const err = new Error(`AI response failed schema validation:\n  - ${validationErrors.join('\n  - ')}`);
    err.code = 'SCHEMA_ERROR';
    throw err;
  }

  // 7. Normalise numeric precision
  parsed.estimated_water_level_ft = Math.round(parsed.estimated_water_level_ft * 10) / 10;
  parsed.confidence_score         = Math.round(parsed.confidence_score * 100)         / 100;

  return parsed;
}

// ---------------------------------------------------------------------------
// Category mapper: AI value -> form <select> value
// ---------------------------------------------------------------------------

/**
 * Maps the AI-returned hazard_category to the GHMC form category dropdown.
 *
 * @param {string} aiCategory
 * @returns {string}
 */
export function mapCategoryToForm(aiCategory) {
  const MAP = {
    'Electricity':    'Electricity',
    'Flooding':       'Sanitation & Drainage',
    'Infrastructure': 'Roads & Infrastructure',
    'Tree Fall':      'Solid Waste Management',
  };
  return MAP[aiCategory] ?? 'Sanitation & Drainage';
}
