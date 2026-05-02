import { LLM_FETCH_TIMEOUT_MS, fetchWithTimeout } from '@/lib/llm/http';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Google Gemini (Google AI Studio API key). Docs: Generative Language API generateContent.
 */
export type GeminiGenerateOptions = {
  /** Ask the model to return only JSON (supported on recent Gemini models). */
  responseMimeTypeJson?: boolean;
  /** Use Google Search grounding (extra billing; see Gemini API docs). */
  googleSearch?: boolean;
};

export async function geminiGenerateText(
  apiKey: string,
  model: string,
  prompt: string,
  options?: GeminiGenerateOptions,
): Promise<string> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error('Missing Gemini API key');
  }
  const q = new URLSearchParams({ key });
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?${q}`;

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
  };
  if (options?.responseMimeTypeJson) {
    body.generationConfig = { responseMimeType: 'application/json' };
  }
  if (options?.googleSearch) {
    body.tools = [{ google_search: {} }];
  }

  const r = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    LLM_FETCH_TIMEOUT_MS,
  );

  const j = (await r.json()) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!r.ok) {
    throw new Error(j.error?.message ?? `Gemini HTTP ${r.status}`);
  }

  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) {
    throw new Error('Gemini returned no text (check model name and API access)');
  }
  return text.trim();
}
