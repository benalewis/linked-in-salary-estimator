/**
 * Salary estimate / LLM request flow — phases and logging.
 *
 * ```mermaid
 * stateDiagram-v2
 *   [*] --> PanelInjected: tryInjectSalaryPanel
 *   PanelInjected --> BusyUI: beginSalaryPanelBusy
 *   BusyUI --> WorkerSent: runtime.sendMessage(lse:estimateSalary)
 *   WorkerSent --> BackgroundIn: service worker receives
 *   BackgroundIn --> AttemptLoop: runSalaryEstimate
 *   AttemptLoop --> Attempt1: json+googleSearch (Gemini)
 *   AttemptLoop --> Attempt2: json only
 *   AttemptLoop --> Attempt3: plain text + parse
 *   Attempt1 --> ParsedOK: valid JSON
 *   Attempt2 --> ParsedOK
 *   Attempt3 --> ParsedOK
 *   ParsedOK --> PanelSuccess: content applies numbers
 *   AttemptLoop --> PanelError: all attempts fail
 *   WorkerSent --> PanelError: message/runtime error
 *   PanelSuccess --> [*]
 *   PanelError --> [*]
 * ```
 *
 * Logs use prefix `[salary-estimator][llm-flow]` so DevTools filter works.
 * Content logs appear on the LinkedIn tab; worker logs in the service worker console.
 */

export const LLM_FLOW_LOG_PREFIX = '[salary-estimator][llm-flow]' as const;

/** Named phases for grep-friendly logs (not an exhaustive enum of every branch). */
export type SalaryEstimateFlowPhase =
  | 'content:estimate_start'
  | 'content:estimate_payload'
  | 'content:estimate_worker_send'
  | 'content:estimate_worker_response'
  | 'content:estimate_apply_success'
  | 'content:estimate_apply_error'
  | 'content:estimate_runtime_error'
  | 'content:estimate_panel_detached'
  | 'bg:estimate_received'
  | 'bg:estimate_invalid_payload'
  | 'bg:estimate_delegate'
  | 'bg:estimate_worker_finished'
  | 'worker:estimate_run_start'
  | 'worker:estimate_attempt'
  | 'worker:estimate_attempt_parse_ok'
  | 'worker:estimate_attempt_parse_fail'
  | 'worker:estimate_attempt_throw'
  | 'worker:estimate_done';

export type LlmFlowLogLevel = 'info' | 'warn' | 'error';

/** Structured LLM-flow logging (always on — use DevTools console on LinkedIn tab + service worker). */
export function logLlmFlow(
  phase: SalaryEstimateFlowPhase | string,
  detail?: Record<string, unknown>,
  level: LlmFlowLogLevel = 'info',
): void {
  const payload =
    detail !== undefined ? { phase, ...detail } : { phase };
  switch (level) {
    case 'warn':
      console.warn(LLM_FLOW_LOG_PREFIX, payload);
      break;
    case 'error':
      console.error(LLM_FLOW_LOG_PREFIX, payload);
      break;
    default:
      console.info(LLM_FLOW_LOG_PREFIX, payload);
  }
}
