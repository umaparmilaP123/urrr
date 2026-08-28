/**
 * analyzeHazardImage.js — thin client wrapper
 * -----------------------------------------------------------------------------
 * Replaced the direct Gemini API call with a proxy call to our own backend.
 * The server reads GEMINI_API_KEY from its own .env — the key never reaches
 * the browser.
 *
 * Return shape is identical to the original implementation:
 *   { hazard_category, estimated_water_level_ft, urgency_level,
 *     confidence_score, incident_title, reasoning }
 *
 * Errors thrown carry the same .code values:
 *   NO_KEY | API_ERROR | PARSE_ERROR | SCHEMA_ERROR | RATE_LIMITED
 *
 * CameraModal.jsx requires zero changes.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Analyzes a base64-encoded image via the backend Gemini proxy.
 *
 * @param {string} imageBase64  Full data URL or raw base64 string.
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
  let response;
  try {
    response = await fetch(`${API_BASE}/api/vision/analyze-hazard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ imageBase64 }),
    });
  } catch (networkErr) {
    const err = new Error(`Network error reaching vision API: ${networkErr.message}`);
    err.code = 'API_ERROR';
    throw err;
  }

  let body;
  try {
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await response.text();
      const err = new Error(
        `Vision API returned non-JSON (${response.status}): ${text.slice(0, 200)}`
      );
      err.code = 'API_ERROR';
      throw err;
    }
    body = await response.json();
  } catch (e) {
    if (e.code) throw e; // re-throw our own structured errors
    const err = new Error('Failed to parse vision API response.');
    err.code = 'PARSE_ERROR';
    throw err;
  }

  if (!response.ok) {
    // Server returns { error, code } on failures
    const err = new Error(body?.error || `Vision API error: HTTP ${response.status}`);
    err.code = body?.code || 'API_ERROR';
    throw err;
  }

  return body;
}

// ---------------------------------------------------------------------------
// Category mapper: AI value → form <select> value (unchanged)
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
