import { readLlmSettingsFull } from '@/lib/llm-settings';
import { routeLlmCompletion } from '@/lib/llm/route-completion';

export type LlmCompleteResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export { routeLlmCompletion } from '@/lib/llm/route-completion';

/** Loads keys from storage and runs completion (service worker only). */
export async function completeWithStoredSettings(prompt: string): Promise<LlmCompleteResult> {
  try {
    const s = await readLlmSettingsFull();
    const text = await routeLlmCompletion(s, prompt);
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[salary-estimator] LLM completion failed', msg);
    return { ok: false, error: msg };
  }
}
