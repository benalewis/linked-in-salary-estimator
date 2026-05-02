import { describe, expect, it } from 'vitest';
import { mergeLlmPatch } from '@/lib/llm-patch';
import { DEFAULT_LLM_SETTINGS, type LlmStoredSettings } from '@/lib/llm-types';

describe('mergeLlmPatch', () => {
  it('keeps API keys when patch omits them', () => {
    const cur: LlmStoredSettings = {
      ...DEFAULT_LLM_SETTINGS,
      geminiApiKey: 'secret-g',
      openaiApiKey: 'secret-o',
    };
    const next = mergeLlmPatch(cur, { providerId: 'openai' });
    expect(next.geminiApiKey).toBe('secret-g');
    expect(next.openaiApiKey).toBe('secret-o');
    expect(next.providerId).toBe('openai');
  });

  it('replaces a key when patch has a new non-empty value', () => {
    const cur: LlmStoredSettings = { ...DEFAULT_LLM_SETTINGS, geminiApiKey: 'old' };
    const next = mergeLlmPatch(cur, { geminiApiKey: 'new' });
    expect(next.geminiApiKey).toBe('new');
  });
});
