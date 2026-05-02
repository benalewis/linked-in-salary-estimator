import type { LlmStoredSettings } from '@/lib/llm-types';

/** Keys update only when patch includes a non-empty string. */
export function mergeLlmPatch(cur: LlmStoredSettings, patch: Partial<LlmStoredSettings>): LlmStoredSettings {
  const next: LlmStoredSettings = {
    providerId:
      patch.providerId === 'openai' || patch.providerId === 'gemini' ? patch.providerId : cur.providerId,
    geminiApiKey: cur.geminiApiKey,
    geminiModel:
      typeof patch.geminiModel === 'string' && patch.geminiModel.trim().length > 0
        ? patch.geminiModel.trim()
        : cur.geminiModel,
    openaiApiKey: cur.openaiApiKey,
    openaiModel:
      typeof patch.openaiModel === 'string' && patch.openaiModel.trim().length > 0
        ? patch.openaiModel.trim()
        : cur.openaiModel,
  };

  if (typeof patch.geminiApiKey === 'string' && patch.geminiApiKey.trim().length > 0) {
    next.geminiApiKey = patch.geminiApiKey.trim();
  }
  if (typeof patch.openaiApiKey === 'string' && patch.openaiApiKey.trim().length > 0) {
    next.openaiApiKey = patch.openaiApiKey.trim();
  }

  return next;
}
