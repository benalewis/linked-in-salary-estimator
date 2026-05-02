import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LLM_SETTINGS, type LlmStoredSettings } from '@/lib/llm-types';
import { routeLlmCompletion } from '@/lib/llm/route-completion';

describe('routeLlmCompletion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls Gemini Generative Language API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'hello gemini' }] } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const s: LlmStoredSettings = {
      ...DEFAULT_LLM_SETTINGS,
      geminiApiKey: 'test-key',
      geminiModel: 'gemini-2.5-flash',
    };

    await expect(routeLlmCompletion(s, 'yo')).resolves.toBe('hello gemini');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('gemini-2.5-flash');
  });

  it('rejects when Gemini key missing', async () => {
    const s: LlmStoredSettings = { ...DEFAULT_LLM_SETTINGS, geminiApiKey: '   ' };
    await expect(routeLlmCompletion(s, 'x')).rejects.toThrow(/key/i);
  });
});
