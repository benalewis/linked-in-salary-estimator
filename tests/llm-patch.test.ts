import { describe, expect, it } from 'vitest';
import { mergeLlmPatch } from '@/lib/llm-patch';
import { DEFAULT_LLM_SETTINGS, type LlmStoredSettings } from '@/lib/llm-types';

describe('mergeLlmPatch', () => {
  it('keeps Gemini API key when patch omits it', () => {
    const cur: LlmStoredSettings = {
      ...DEFAULT_LLM_SETTINGS,
      geminiApiKey: 'secret-g',
      geminiModel: 'gemini-2.5-flash',
    };
    const next = mergeLlmPatch(cur, { geminiModel: 'gemini-2.5-pro' });
    expect(next.geminiApiKey).toBe('secret-g');
    expect(next.geminiModel).toBe('gemini-2.5-pro');
  });

  it('replaces a key when patch has a new non-empty value', () => {
    const cur: LlmStoredSettings = { ...DEFAULT_LLM_SETTINGS, geminiApiKey: 'old' };
    const next = mergeLlmPatch(cur, { geminiApiKey: 'new' });
    expect(next.geminiApiKey).toBe('new');
  });
});
