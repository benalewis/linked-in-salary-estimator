/**
 * Gemini 2.0 Flash is deprecated / unavailable to new API users.
 * @see https://ai.google.dev/gemini-api/docs/changelog
 */
export function upgradeDeprecatedGeminiModel(model: string): string {
  const m = model.trim();
  if (!m) {
    return m;
  }
  const lower = m.toLowerCase();
  if (lower === 'gemini-2.0-flash-lite' || lower === 'gemini-2.0-flash-lite-001') {
    return 'gemini-2.5-flash-lite';
  }
  if (
    lower === 'gemini-2.0-flash' ||
    lower === 'gemini-2.0-flash-001' ||
    lower.startsWith('gemini-2.0-flash')
  ) {
    return 'gemini-2.5-flash';
  }
  return m;
}
