/**
 * Shorter guidance for Gemini API errors surfaced in popup / salary panel copy.
 */

export function friendlyLlmErrorMessage(message: string): string {
  const m = message.trim();
  if (/exceeded your current quota|insufficient_quota|billing hard limit/i.test(m)) {
    return 'Quota or billing issue — check Google AI / Gemini usage limits and billing, or try another model (e.g. gemini-2.5-flash).';
  }
  if (/API key not valid|API_KEY_INVALID|401|permission denied/i.test(m)) {
    return 'Gemini API key rejected — create or rotate a key in Google AI Studio (aistudio.google.com/apikey).';
  }
  if (/rate limit|429|Too Many Requests|RESOURCE_EXHAUSTED/i.test(m)) {
    return 'Rate limited — retry later or use a lighter model id; see ai.google.dev/gemini-api/docs/rate-limits.';
  }
  return m.length > 280 ? `${m.slice(0, 277)}…` : m;
}
