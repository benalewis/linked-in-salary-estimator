/** Persisted in storage.local (includes Gemini API key). */
export type LlmStoredSettings = {
  /** When false, the extension does not call Gemini (salary estimates + LLM test). */
  geminiEnabled: boolean;
  geminiApiKey: string;
  geminiModel: string;
};

/** Safe subset for the popup (no raw keys). */
export type LlmSettingsView = {
  geminiEnabled: boolean;
  geminiModel: string;
  geminiKeyConfigured: boolean;
};

export const DEFAULT_LLM_SETTINGS: LlmStoredSettings = {
  geminiEnabled: true,
  geminiApiKey: '',
  /**
   * Cheapest broadly available tier in the 2.5 line (see pricing + model card).
   * @see https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite
   */
  geminiModel: 'gemini-2.5-flash-lite',
};
