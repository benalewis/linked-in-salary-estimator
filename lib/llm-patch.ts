import type { LlmStoredSettings } from '@/lib/llm-types';

/** Keys update only when patch includes a non-empty string. */
export function mergeLlmPatch(cur: LlmStoredSettings, patch: Partial<LlmStoredSettings>): LlmStoredSettings {
  const next: LlmStoredSettings = {
    geminiEnabled: typeof patch.geminiEnabled === 'boolean' ? patch.geminiEnabled : cur.geminiEnabled,
    geminiApiKey: cur.geminiApiKey,
    geminiModel:
      typeof patch.geminiModel === 'string' && patch.geminiModel.trim().length > 0
        ? patch.geminiModel.trim()
        : cur.geminiModel,
  };

  if (typeof patch.geminiApiKey === 'string' && patch.geminiApiKey.trim().length > 0) {
    next.geminiApiKey = patch.geminiApiKey.trim();
  }

  return next;
}
