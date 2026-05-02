import type { LlmStoredSettings } from '@/lib/llm-types';
import { geminiGenerateText } from '@/lib/llm/providers/gemini';
import { openaiGenerateText } from '@/lib/llm/providers/openai';

export type RouteLlmCompletionOptions = {
  /** Prefer structured JSON from the model when the provider supports it. */
  jsonObject?: boolean;
  /** Gemini only: enable Grounding with Google Search (ignored for OpenAI). */
  geminiGoogleSearch?: boolean;
};

/** Provider dispatch — no storage import (safe for unit tests in Node). */
export async function routeLlmCompletion(
  settings: LlmStoredSettings,
  prompt: string,
  options?: RouteLlmCompletionOptions,
): Promise<string> {
  const p = prompt.trim();
  if (!p) {
    throw new Error('Empty prompt');
  }

  switch (settings.providerId) {
    case 'gemini': {
      if (!settings.geminiApiKey.trim()) {
        throw new Error('Configure a Gemini API key in the extension popup (Google AI Studio).');
      }
      return await geminiGenerateText(settings.geminiApiKey, settings.geminiModel, p, {
        responseMimeTypeJson: options?.jsonObject,
        googleSearch: options?.geminiGoogleSearch,
      });
    }
    case 'openai': {
      if (!settings.openaiApiKey.trim()) {
        throw new Error('Configure an OpenAI API key in the extension popup.');
      }
      return await openaiGenerateText(settings.openaiApiKey, settings.openaiModel, p, {
        jsonObject: options?.jsonObject,
      });
    }
    default: {
      throw new Error('Unknown LLM provider');
    }
  }
}
