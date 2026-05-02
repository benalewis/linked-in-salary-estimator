import browser from '@/lib/browser';
import { upgradeDeprecatedGeminiModel } from '@/lib/llm-gemini-model';
import { mergeLlmPatch } from '@/lib/llm-patch';
import {
  DEFAULT_LLM_SETTINGS,
  type LlmSettingsView,
  type LlmStoredSettings,
} from '@/lib/llm-types';

export const LLM_SETTINGS_KEY = 'lseLlmSettings' as const;

export type { LlmSettingsView, LlmStoredSettings };
export { DEFAULT_LLM_SETTINGS };
export { mergeLlmPatch } from '@/lib/llm-patch';

/** Legacy blobs may contain `providerId` / OpenAI keys — ignored; only Gemini fields are kept. */
function normalizeStored(raw: unknown): LlmStoredSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_LLM_SETTINGS };
  }
  const o = raw as Partial<LlmStoredSettings>;
  const geminiModelRaw =
    typeof o.geminiModel === 'string' && o.geminiModel.trim().length > 0
      ? o.geminiModel.trim()
      : DEFAULT_LLM_SETTINGS.geminiModel;
  return {
    geminiApiKey: typeof o.geminiApiKey === 'string' ? o.geminiApiKey : '',
    geminiModel: upgradeDeprecatedGeminiModel(geminiModelRaw),
  };
}

/** Full settings including secrets — popup & service worker. Persists Gemini model migration once. */
export async function readLlmSettingsFull(): Promise<LlmStoredSettings> {
  const bag = await browser.storage.local.get(LLM_SETTINGS_KEY);
  const raw = bag[LLM_SETTINGS_KEY];
  const o = raw && typeof raw === 'object' ? (raw as Partial<LlmStoredSettings>) : null;
  const beforeModel = typeof o?.geminiModel === 'string' ? o.geminiModel.trim() : '';
  const s = normalizeStored(raw);
  if (
    beforeModel.length > 0 &&
    upgradeDeprecatedGeminiModel(beforeModel) !== beforeModel
  ) {
    await writeLlmSettingsFull(s);
  }
  return s;
}

export async function writeLlmSettingsFull(s: LlmStoredSettings): Promise<void> {
  await browser.storage.local.set({ [LLM_SETTINGS_KEY]: s });
}

export function toLlmSettingsView(s: LlmStoredSettings): LlmSettingsView {
  return {
    geminiModel: s.geminiModel,
    geminiKeyConfigured: Boolean(s.geminiApiKey.trim()),
  };
}

export async function mergeLlmSettings(patch: Partial<LlmStoredSettings>): Promise<LlmStoredSettings> {
  const cur = await readLlmSettingsFull();
  const next = mergeLlmPatch(cur, patch);
  await writeLlmSettingsFull(next);
  return next;
}
