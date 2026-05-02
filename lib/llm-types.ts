export type LlmProviderId = 'gemini' | 'openai';

/** Persisted in storage.local (includes API keys). */
export type LlmStoredSettings = {
  providerId: LlmProviderId;
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiModel: string;
};

/** Safe subset for the popup (no raw keys). */
export type LlmSettingsView = {
  providerId: LlmProviderId;
  geminiModel: string;
  openaiModel: string;
  geminiKeyConfigured: boolean;
  openaiKeyConfigured: boolean;
};

export const DEFAULT_LLM_SETTINGS: LlmStoredSettings = {
  providerId: 'gemini',
  geminiApiKey: '',
  /** `gemini-2.0-flash` is deprecated / blocked for new keys — use 2.5+ per Google. */
  geminiModel: 'gemini-2.5-flash',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
};
