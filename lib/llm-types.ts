/** Persisted in storage.local (includes Gemini API key). */
export type LlmStoredSettings = {
  geminiApiKey: string;
  geminiModel: string;
};

/** Safe subset for the popup (no raw keys). */
export type LlmSettingsView = {
  geminiModel: string;
  geminiKeyConfigured: boolean;
};

export const DEFAULT_LLM_SETTINGS: LlmStoredSettings = {
  geminiApiKey: '',
  /** `gemini-2.0-flash` is deprecated / blocked for new keys — use 2.5+ per Google. */
  geminiModel: 'gemini-2.5-flash',
};
