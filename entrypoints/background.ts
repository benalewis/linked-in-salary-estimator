import { ensureDefaultSettings, type LseSettings } from '@/lib/lse-settings';
import {
  mergeLlmSettings,
  readLlmSettingsFull,
  toLlmSettingsView,
  type LlmSettingsView,
  type LlmStoredSettings,
} from '@/lib/llm-settings';
import { completeWithStoredSettings, type LlmCompleteResult } from '@/lib/llm/router';
import { logLlmFlow } from '@/lib/salary-estimate-flow';
import { runSalaryEstimate } from '@/lib/salary-estimate-service';
import type { SalaryEstimateInput, SalaryEstimateWorkerResult } from '@/lib/salary-estimate-types';

const MSG_GET_SETTINGS = 'lse:getSettings' as const;
const MSG_GET_LLM_SETTINGS = 'lse:getLlmSettings' as const;
const MSG_SAVE_LLM_SETTINGS = 'lse:saveLlmSettings' as const;
const MSG_LLM_COMPLETE = 'lse:llmComplete' as const;
const MSG_ESTIMATE_SALARY = 'lse:estimateSalary' as const;

export default defineBackground(() => {
  console.info('[salary-estimator] background ready', browser.runtime.id);

  browser.runtime.onInstalled.addListener(() => {
    void ensureDefaultSettings();
  });

  browser.runtime.onMessage.addListener(
    (
      message: {
        type?: string;
        payload?: Partial<LlmStoredSettings> | SalaryEstimateInput;
        prompt?: string;
      },
      _sender,
      sendResponse: (r: LseSettings | LlmSettingsView | LlmCompleteResult | SalaryEstimateWorkerResult) => void,
    ) => {
      const t = message?.type;

      if (t === MSG_GET_SETTINGS) {
        void ensureDefaultSettings()
          .then((s) => {
            sendResponse(s);
          })
          .catch((err: unknown) => {
            console.error('[salary-estimator] getSettings / ensureDefaultSettings failed', err);
            sendResponse({ currencyCode: 'USD', estimateRunMode: 'manual' });
          });
        return true;
      }

      if (t === MSG_GET_LLM_SETTINGS) {
        void readLlmSettingsFull()
          .then(toLlmSettingsView)
          .then(sendResponse)
          .catch((err: unknown) => {
            console.error('[salary-estimator] getLlmSettings failed', err);
            sendResponse({
              geminiEnabled: true,
              geminiModel: 'gemini-2.5-flash-lite',
              geminiKeyConfigured: false,
            });
          });
        return true;
      }

      if (t === MSG_SAVE_LLM_SETTINGS) {
        void mergeLlmSettings((message.payload ?? {}) as Partial<LlmStoredSettings>)
          .then(toLlmSettingsView)
          .then(sendResponse)
          .catch((err: unknown) => {
            console.error('[salary-estimator] saveLlmSettings failed', err);
            void readLlmSettingsFull()
              .then(toLlmSettingsView)
              .then(sendResponse);
          });
        return true;
      }

      if (t === MSG_LLM_COMPLETE) {
        const prompt = typeof message.prompt === 'string' ? message.prompt : '';
        void completeWithStoredSettings(prompt).then(sendResponse);
        return true;
      }

      if (t === MSG_ESTIMATE_SALARY) {
        const p = message.payload as SalaryEstimateInput | undefined;
        const okPayload =
          p &&
          typeof p.experienceRowText === 'string' &&
          typeof p.outputCurrency === 'string' &&
          typeof p.profileUrl === 'string';
        if (!okPayload) {
          logLlmFlow(
            'bg:estimate_invalid_payload',
            { hasPayload: message.payload != null },
            'warn',
          );
          sendResponse({ ok: false, error: 'Invalid salary estimate payload' });
          return true;
        }
        logLlmFlow('bg:estimate_received', {
          requestId: p.requestId ?? 'none',
          outputCurrency: p.outputCurrency,
          profileUrl: p.profileUrl,
          experienceChars: p.experienceRowText.length,
        });
        logLlmFlow('bg:estimate_delegate', { requestId: p.requestId ?? 'none' });
        void runSalaryEstimate(p).then((result) => {
          logLlmFlow(
            'bg:estimate_worker_finished',
            {
              requestId: p.requestId ?? 'none',
              ok: result.ok,
              ...(result.ok ? {} : { error: result.error }),
            },
            result.ok ? 'info' : 'warn',
          );
          sendResponse(result);
        });
        return true;
      }

      return false;
    },
  );
});
