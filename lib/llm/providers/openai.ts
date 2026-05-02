import { LLM_FETCH_TIMEOUT_MS, fetchWithTimeout } from '@/lib/llm/http';

const OPENAI_CHAT = 'https://api.openai.com/v1/chat/completions';

export type OpenAiGenerateOptions = {
  jsonObject?: boolean;
};

/** OpenAI Chat Completions (Bearer API key). */
export async function openaiGenerateText(
  apiKey: string,
  model: string,
  prompt: string,
  options?: OpenAiGenerateOptions,
): Promise<string> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error('Missing OpenAI API key');
  }

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
  };
  if (options?.jsonObject) {
    body.response_format = { type: 'json_object' };
  }

  const r = await fetchWithTimeout(
    OPENAI_CHAT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    },
    LLM_FETCH_TIMEOUT_MS,
  );

  const j = (await r.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!r.ok) {
    throw new Error(j.error?.message ?? `OpenAI HTTP ${r.status}`);
  }

  const text = j.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('OpenAI returned no text');
  }
  return text.trim();
}
