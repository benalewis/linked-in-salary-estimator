import '@/assets/linkedin-panel.css';
import browser from '@/lib/browser';
import { extensionContextIsStale, formatExtensionSideError } from '@/lib/extension-context';
import {
  LSE_SETTINGS_KEY,
  type EstimateRunMode,
  type LseSettings,
} from '@/lib/lse-settings';
import type { InjectionResult } from '@/lib/linkedin-panel';
import {
  applySalaryEstimateToPanel,
  applySalaryPanelError,
  beginSalaryPanelBusy,
  collectSalaryEstimateContext,
  LSE_PANEL_ATTR,
  mutationsAreOnlyInsideSalaryPanel,
  removeSalaryPanel,
  resolveExperienceHostFromSalaryPanel,
  tryInjectSalaryPanel,
} from '@/lib/linkedin-panel';
import { friendlyLlmErrorMessage } from '@/lib/llm-user-errors';
import { logLlmFlow } from '@/lib/salary-estimate-flow';
import {
  readCachedSalaryEstimate,
  writeCachedSalaryEstimate,
} from '@/lib/salary-estimate-cache';
import type { SalaryEstimateInput, SalaryEstimateWorkerResult } from '@/lib/salary-estimate-types';
import { lseDbg, lseDebugEnabled } from '@/lib/lse-debug';

function newEstimateRequestId(): string {
  return `est-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function logActive(): void {
  console.log('[salary-estimator] active', {
    path: location.pathname,
    name: browser.runtime.getManifest().name,
  });
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t) {
      clearTimeout(t);
    }
    t = setTimeout(() => {
      t = undefined;
      fn(...args);
    }, ms);
  };
}

function digestInjection(
  r: InjectionResult,
  displayCurrencyCode: string,
  estimateRunMode: EstimateRunMode,
): string {
  return `${estimateRunMode}:${displayCurrencyCode}:${r.success}:${r.reason}:${JSON.stringify(r.details)}`;
}

function logInjectOutcome(result: InjectionResult): void {
  // Always logs (not behind lse-debug) so DevTools shows outcome after reload/build.
  const d = result.details;
  console.log('[salary-estimator] inject', {
    success: result.success,
    reason: result.reason,
    matchStrategy: d.matchStrategy,
    itemCount: d.itemCount,
    path: d.path,
  });
}

export default defineContentScript({
  matches: ['*://*.linkedin.com/*'],
  runAt: 'document_idle',
  main() {
    try {
      const ver = browser.runtime.getManifest().version;
      console.log('[salary-estimator] ready', { version: ver, path: location.pathname });
      console.info(
        '[salary-estimator] DevTools must be open on this LinkedIn tab to see these logs (not the extension popup).',
      );
      logActive();

      if (lseDebugEnabled()) {
        lseDbg('full debug on — set sessionStorage.setItem("lse-debug","0") to hide verbose lines', {
          path: location.pathname,
        });
      }

      let lastInjectDigest = '';
      let displayCurrencyCode = 'USD';
      let estimateRunMode: EstimateRunMode = 'manual';
      let prefsResolved = false;

      const MO_OPTS: MutationObserverInit = { childList: true, subtree: true, characterData: true };
      let mo!: MutationObserver;

      async function requestSalaryEstimate(panelEl: HTMLElement, ccy: string): Promise<void> {
        const experienceRow = resolveExperienceHostFromSalaryPanel(panelEl);
        if (!(experienceRow instanceof HTMLElement)) {
          return;
        }
        if (extensionContextIsStale()) {
          if (panelEl.isConnected) {
            applySalaryPanelError(panelEl, formatExtensionSideError('Extension context invalidated.'));
            panelEl.dataset.lseEstimateState = 'error';
          }
          return;
        }
        if (panelEl.dataset.lseEstimateState === 'pending') {
          return;
        }
        panelEl.dataset.lseEstimateState = 'pending';
        const profileHref = location.href;
        const rowTextForCache = (experienceRow.innerText ?? '').replace(/\s+/g, ' ').trim();
        const requestId = newEstimateRequestId();
        panelEl.dataset.lseRequestId = requestId;

        try {
          const cached = await readCachedSalaryEstimate(profileHref, rowTextForCache, ccy);
          if (cached) {
            if (panelEl.isConnected) {
              applySalaryEstimateToPanel(panelEl, cached, ccy);
              panelEl.dataset.lseEstimateState = 'ok';
              logLlmFlow('content:estimate_cache_hit', {
                requestId,
                displayCurrency: ccy,
                salaryLow: cached.salaryLow,
                salaryHigh: cached.salaryHigh,
              });
              logLlmFlow('content:estimate_apply_success', { requestId, fromCache: true });
            }
            return;
          }
        } catch (e) {
          console.warn('[salary-estimator] estimate cache read failed', e);
        }

        logLlmFlow('content:estimate_start', { requestId, displayCurrency: ccy });
        const endBusy = beginSalaryPanelBusy(panelEl);
        try {
          const payload: SalaryEstimateInput = {
            ...collectSalaryEstimateContext(experienceRow, ccy),
            requestId,
          };
          logLlmFlow('content:estimate_payload', {
            requestId,
            experienceChars: payload.experienceRowText.length,
            outputCurrency: payload.outputCurrency,
            hasProfileName: Boolean(payload.profileName),
          });
          logLlmFlow('content:estimate_worker_send', { requestId, messageType: 'lse:estimateSalary' });
          const res = (await browser.runtime.sendMessage({
            type: 'lse:estimateSalary',
            payload,
          })) as SalaryEstimateWorkerResult;
          endBusy();
          if (!panelEl.isConnected) {
            logLlmFlow('content:estimate_panel_detached', { requestId }, 'warn');
            return;
          }
          logLlmFlow('content:estimate_worker_response', {
            requestId,
            ok: res.ok,
            ...(res.ok ? { salaryLow: res.estimate.salaryLow, salaryHigh: res.estimate.salaryHigh } : { error: res.error }),
          });
          if (res.ok) {
            applySalaryEstimateToPanel(panelEl, res.estimate, ccy);
            panelEl.dataset.lseEstimateState = 'ok';
            logLlmFlow('content:estimate_apply_success', { requestId });
            try {
              await writeCachedSalaryEstimate(profileHref, rowTextForCache, ccy, res.estimate);
            } catch (e) {
              console.warn('[salary-estimator] estimate cache write failed', e);
            }
          } else {
            applySalaryPanelError(panelEl, friendlyLlmErrorMessage(res.error));
            panelEl.dataset.lseEstimateState = 'error';
            logLlmFlow('content:estimate_apply_error', { requestId, error: res.error }, 'warn');
          }
        } catch (e) {
          endBusy();
          const raw = e instanceof Error ? e.message : String(e);
          const err = friendlyLlmErrorMessage(formatExtensionSideError(raw));
          logLlmFlow('content:estimate_runtime_error', { requestId, error: err }, 'warn');
          if (panelEl.isConnected) {
            applySalaryPanelError(panelEl, err);
            panelEl.dataset.lseEstimateState = 'error';
          }
        }
      }

      async function resolveContentPrefs(): Promise<void> {
        if (prefsResolved) {
          return;
        }
        /** Safety net if the service worker never responds (should be rare after provisional defaults). */
        const MESSAGE_WAIT_MS = 10_000;
        try {
          const msg = browser.runtime.sendMessage({ type: 'lse:getSettings' }) as Promise<LseSettings | undefined>;
          const timeout = new Promise<never>((_, rej) => {
            setTimeout(() => rej(new Error('lse:getSettings timeout')), MESSAGE_WAIT_MS);
          });
          const s = await Promise.race([msg, timeout]);
          if (s && typeof s.currencyCode === 'string') {
            displayCurrencyCode = s.currencyCode;
          }
          if (s && (s.estimateRunMode === 'auto' || s.estimateRunMode === 'manual')) {
            estimateRunMode = s.estimateRunMode;
          }
          console.info('[salary-estimator] prefs', displayCurrencyCode, estimateRunMode);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/extension context invalidated/i.test(msg)) {
            console.warn('[salary-estimator] extension context invalidated — refresh this LinkedIn tab after reloading the extension.', e);
          } else {
            console.warn('[salary-estimator] getSettings failed — using USD + manual until background responds', e);
          }
          displayCurrencyCode = 'USD';
          estimateRunMode = 'manual';
        }
        prefsResolved = true;
      }

      const scheduleInject = debounce(() => {
        void (async () => {
          mo.disconnect();
          try {
            await resolveContentPrefs();
            const result = tryInjectSalaryPanel(displayCurrencyCode, estimateRunMode);
            const d = digestInjection(result, displayCurrencyCode, estimateRunMode);
            if (d !== lastInjectDigest) {
              lastInjectDigest = d;
              logInjectOutcome(result);
              lseDbg('inject summary (full)', result);
            }
            if (result.success && result.panelEl) {
              const p = result.panelEl;
              if (estimateRunMode === 'manual') {
                if (!p.dataset.lseEstimateState) {
                  p.dataset.lseEstimateState = 'idle-manual';
                }
              } else {
                const st = p.dataset.lseEstimateState;
                if (st !== 'pending' && st !== 'ok') {
                  void requestSalaryEstimate(p, displayCurrencyCode);
                }
              }
            }
          } catch (e) {
            console.error('[salary-estimator] inject error', e);
          } finally {
            mo.observe(document.documentElement, MO_OPTS);
          }
        })();
      }, 400);

      document.addEventListener(
        'click',
        (e: MouseEvent) => {
          const t = e.target;
          const btn = t instanceof Element ? t.closest('[data-lse-run-estimate]') : null;
          if (!(btn instanceof HTMLButtonElement)) {
            return;
          }
          const panelEl = btn.closest(`[${LSE_PANEL_ATTR}]`);
          if (!(panelEl instanceof HTMLElement)) {
            return;
          }
          if (panelEl.dataset.lseEstimateState === 'pending') {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          void requestSalaryEstimate(panelEl, displayCurrencyCode);
        },
        true,
      );

      mo = new MutationObserver((records) => {
        if (mutationsAreOnlyInsideSalaryPanel(records)) {
          lseDbg('mutation observer skipped (DOM churn is only inside salary panel)', {
            count: records.length,
          });
          return;
        }
        scheduleInject();
      });
      mo.observe(document.documentElement, MO_OPTS);

      browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes[LSE_SETTINGS_KEY]) {
          return;
        }
        const nv = changes[LSE_SETTINGS_KEY]!.newValue as
          | { currencyCode?: string; estimateRunMode?: EstimateRunMode }
          | undefined;
        if (nv && typeof nv.currencyCode === 'string') {
          displayCurrencyCode = nv.currencyCode;
        }
        if (nv && (nv.estimateRunMode === 'auto' || nv.estimateRunMode === 'manual')) {
          estimateRunMode = nv.estimateRunMode;
        }
        lastInjectDigest = '';
        removeSalaryPanel();
        scheduleInject();
      });

      scheduleInject();

      let lastHref = location.href;
      function hrefChangedSweep(): boolean {
        if (location.href === lastHref) {
          return false;
        }
        lastHref = location.href;
        logActive();
        lastInjectDigest = '';
        removeSalaryPanel();
        return true;
      }
      /** `popstate` always re-schedules (LinkedIn SPA); poll only when hash/path actually moved. */
      window.addEventListener('popstate', () => {
        hrefChangedSweep();
        scheduleInject();
      });
      setInterval(() => {
        if (hrefChangedSweep()) {
          scheduleInject();
        }
      }, 1000);
    } catch (e) {
      console.error('[salary-estimator] content script failed to start', e);
    }
  },
});
