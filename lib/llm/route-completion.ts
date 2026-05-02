import type { LlmStoredSettings } from '@/lib/llm-types';
import { geminiGenerateText } from '@/lib/llm/providers/gemini';

export type RouteLlmCompletionOptions = {
  /** Prefer structured JSON from the model when supported. */
  jsonObject?: boolean;
  /** Enable Grounding with Google Search (Gemini). */
  geminiGoogleSearch?: boolean;
};

/** Gemini Generative Language API — no storage import (safe for unit tests in Node). */
export async function routeLlmCompletion(
  settings: LlmStoredSettings,
  prompt: string,
  options?: RouteLlmCompletionOptions,
): Promise<string> {
  const p = prompt.trim();
  if (!p) {
    throw new Error('Empty prompt');
  }
  if (!settings.geminiApiKey.trim()) {
    throw new Error('Configure a Gemini API key in the extension popup (Google AI Studio).');
  }
  return await geminiGenerateText(settings.geminiApiKey, settings.geminiModel, p, {
    responseMimeTypeJson: options?.jsonObject,
    googleSearch: options?.geminiGoogleSearch,
  });
}
