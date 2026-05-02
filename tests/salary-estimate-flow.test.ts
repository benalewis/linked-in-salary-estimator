import { afterEach, describe, expect, it, vi } from 'vitest';
import { LLM_FLOW_LOG_PREFIX, logLlmFlow } from '@/lib/salary-estimate-flow';

describe('logLlmFlow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs with phase and prefix', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    logLlmFlow('worker:estimate_done', { requestId: 'x', ok: true });
    expect(info).toHaveBeenCalledWith(LLM_FLOW_LOG_PREFIX, {
      phase: 'worker:estimate_done',
      requestId: 'x',
      ok: true,
    });
  });

  it('uses warn level when requested', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logLlmFlow('worker:estimate_done', { ok: false }, 'warn');
    expect(warn).toHaveBeenCalled();
  });
});
