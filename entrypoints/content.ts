import '@/assets/linkedin-panel.css';
import browser from '@/lib/browser';
import { LSE_SETTINGS_KEY, type LseSettings } from '@/lib/lse-settings';
import type { InjectionResult } from '@/lib/linkedin-panel';
import { removeSalaryPanel, tryInjectSalaryPanel } from '@/lib/linkedin-panel';
import { lseDbg, lseDebugEnabled } from '@/lib/lse-debug';

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

function digestInjection(r: InjectionResult): string {
  return `${r.success}:${r.reason}:${JSON.stringify(r.details)}`;
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
      let currencyResolved = false;

      async function resolveDisplayCurrency(): Promise<void> {
        if (currencyResolved) {
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
          console.info('[salary-estimator] currency label', displayCurrencyCode);
        } catch (e) {
          console.warn('[salary-estimator] getSettings failed — using USD for panel until background responds', e);
          displayCurrencyCode = 'USD';
        }
        currencyResolved = true;
      }

      const scheduleInject = debounce(() => {
        void (async () => {
          try {
            await resolveDisplayCurrency();
            const result = tryInjectSalaryPanel(displayCurrencyCode);
            const d = digestInjection(result);
            if (d !== lastInjectDigest) {
              lastInjectDigest = d;
              logInjectOutcome(result);
              lseDbg('inject summary (full)', result);
            }
          } catch (e) {
            console.error('[salary-estimator] inject error', e);
          }
        })();
      }, 400);

      browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes[LSE_SETTINGS_KEY]) {
          return;
        }
        const nv = changes[LSE_SETTINGS_KEY]!.newValue as { currencyCode?: string } | undefined;
        if (nv && typeof nv.currencyCode === 'string') {
          displayCurrencyCode = nv.currencyCode;
        }
        lastInjectDigest = '';
        removeSalaryPanel();
        scheduleInject();
      });

      scheduleInject();

      let lastHref = location.href;
      const onMaybeNavigate = () => {
        if (location.href !== lastHref) {
          lastHref = location.href;
          logActive();
          lastInjectDigest = '';
          removeSalaryPanel();
        }
        scheduleInject();
      };

      window.addEventListener('popstate', onMaybeNavigate);

      const hrefPoll = () => {
        if (location.href !== lastHref) {
          lastHref = location.href;
          logActive();
          lastInjectDigest = '';
          removeSalaryPanel();
          scheduleInject();
        }
      };
      setInterval(hrefPoll, 1000);

      const mo = new MutationObserver(() => scheduleInject());
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {
      console.error('[salary-estimator] content script failed to start', e);
    }
  },
});
