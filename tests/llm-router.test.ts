import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LLM_SETTINGS, type LlmStoredSettings } from '@/lib/llm-types';
import { routeLlmCompletion } from '@/lib/llm/route-completion';

describe('routeLlmCompletion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls Gemini endpoint when provider is gemini', async () => {
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

  it('calls OpenAI when provider is openai', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hello openai' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const s: LlmStoredSettings = {
      ...DEFAULT_LLM_SETTINGS,
      providerId: 'openai',
      openaiApiKey: 'sk-test',
      openaiModel: 'gpt-4o-mini',
    };

    await expect(routeLlmCompletion(s, 'yo')).resolves.toBe('hello openai');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api.openai.com');
  });

  it('rejects when Gemini key missing', async () => {
    const s: LlmStoredSettings = { ...DEFAULT_LLM_SETTINGS, geminiApiKey: '   ' };
    await expect(routeLlmCompletion(s, 'x')).rejects.toThrow(/key/i);
  });
});
