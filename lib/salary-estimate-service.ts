import { logLlmFlow } from '@/lib/salary-estimate-flow';
import { readLlmSettingsFull } from '@/lib/llm-settings';
import { routeLlmCompletion } from '@/lib/llm/route-completion';
import { buildSalaryEstimatePrompt } from '@/lib/salary-prompt';
import { parseSalaryEstimateFromModelText } from '@/lib/salary-parse';
import type { SalaryEstimateInput, SalaryEstimateWorkerResult } from '@/lib/salary-estimate-types';

/**
 * Runs the salary estimate prompt against the configured LLM (service worker / Node tests).
 * Gemini: tries JSON + Google Search first, then JSON without search, then plain text.
 * OpenAI: JSON mode when supported, else plain.
 */
export async function runSalaryEstimate(input: SalaryEstimateInput): Promise<SalaryEstimateWorkerResult> {
  const rid = input.requestId ?? '(no-request-id)';
  const prompt = buildSalaryEstimatePrompt(input);
  const settings = await readLlmSettingsFull();

  logLlmFlow('worker:estimate_run_start', {
    requestId: rid,
    providerId: settings.providerId,
    model:
      settings.providerId === 'gemini'
        ? settings.geminiModel
        : settings.providerId === 'openai'
          ? settings.openaiModel
          : 'unknown',
    outputCurrency: input.outputCurrency,
    experiencePreview: input.experienceRowText.slice(0, 120),
  });

  const attempts: Array<{ label: string; jsonObject: boolean; geminiGoogleSearch: boolean }> = [
    { label: 'json+googleSearch', jsonObject: true, geminiGoogleSearch: true },
    { label: 'json', jsonObject: true, geminiGoogleSearch: false },
    { label: 'plain', jsonObject: false, geminiGoogleSearch: false },
  ];

  let lastError = 'Unknown error';

  for (let i = 0; i < attempts.length; i++) {
    const { label, ...opts } = attempts[i]!;
    logLlmFlow('worker:estimate_attempt', {
      requestId: rid,
      attemptIndex: i + 1,
      attemptLabel: label,
      jsonObject: opts.jsonObject,
      geminiGoogleSearch: opts.geminiGoogleSearch,
    });
    try {
      const text = await routeLlmCompletion(settings, prompt, opts);
      const preview = text.slice(0, 200);
      const parsed = parseSalaryEstimateFromModelText(text);
      if (parsed) {
        logLlmFlow('worker:estimate_attempt_parse_ok', {
          requestId: rid,
          attemptIndex: i + 1,
          attemptLabel: label,
          responseChars: text.length,
          responsePreview: preview,
          parsedCurrency: parsed.currency,
        });
        logLlmFlow('worker:estimate_done', { requestId: rid, ok: true, attemptUsed: i + 1, attemptLabel: label });
        return { ok: true, estimate: parsed };
      }
      lastError = 'Model response was not valid salary JSON';
      logLlmFlow(
        'worker:estimate_attempt_parse_fail',
        {
          requestId: rid,
          attemptIndex: i + 1,
          attemptLabel: label,
          responseChars: text.length,
          responsePreview: preview,
        },
        'warn',
      );
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      logLlmFlow(
        'worker:estimate_attempt_throw',
        {
          requestId: rid,
          attemptIndex: i + 1,
          attemptLabel: label,
          error: lastError,
        },
        'warn',
      );
    }
  }

  logLlmFlow('worker:estimate_done', { requestId: rid, ok: false, error: lastError }, 'warn');
  return { ok: false, error: lastError };
}
