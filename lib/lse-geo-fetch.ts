/**
 * Fetches approximate currency from IP using public HTTPS endpoints (fallback chain).
 * Used only from the extension service worker.
 */

const IPAPI_JSON = 'https://ipapi.co/json/';
const IPWHO_IP = 'https://ipwho.is/ip';

const FETCH_TIMEOUT_MS = 8_000;

function logGeo(level: 'info' | 'warn', msg: string, detail?: unknown): void {
  const fn = level === 'warn' ? console.warn : console.info;
  if (detail !== undefined) {
    fn(`[salary-estimator] geo ${msg}`, detail);
  } else {
    fn(`[salary-estimator] geo ${msg}`);
  }
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { credentials: 'omit', signal: ctrl.signal });
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseIpapiCurrency(j: unknown): string | null {
  if (!j || typeof j !== 'object') {
    return null;
  }
  const o = j as { currency?: unknown; error?: unknown };
  if (o.error) {
    throw new Error(String(o.error));
  }
  const c = o.currency;
  if (typeof c === 'string' && /^[A-Za-z]{3}$/.test(c)) {
    return c.toUpperCase();
  }
  return null;
}

function parseIpwhoCurrency(j: unknown): string | null {
  if (!j || typeof j !== 'object') {
    return null;
  }
  const o = j as {
    success?: unknown;
    currency?: unknown;
    currency_code?: unknown;
  };
  if (o.success === false) {
    throw new Error('ipwho: success false');
  }
  if (o.currency && typeof o.currency === 'object') {
    const code = (o.currency as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Za-z]{3}$/.test(code)) {
      return code.toUpperCase();
    }
  }
  if (typeof o.currency_code === 'string' && /^[A-Za-z]{3}$/.test(o.currency_code)) {
    return o.currency_code.toUpperCase();
  }
  return null;
}

/** Tries ipapi.co, then ipwho.is (common fallback when ipapi rate-limits). */
export async function fetchGeoCurrencyFromNetwork(): Promise<string> {
  try {
    const j = await fetchJsonWithTimeout(IPAPI_JSON);
    const code = parseIpapiCurrency(j);
    if (code) {
      logGeo('info', `ipapi OK → ${code}`);
      return code;
    }
    throw new Error('ipapi: missing currency field');
  } catch (e) {
    logGeo('warn', 'ipapi failed, trying ipwho.is', e instanceof Error ? e.message : e);
  }

  try {
    const j = await fetchJsonWithTimeout(IPWHO_IP);
    const code = parseIpwhoCurrency(j);
    if (code) {
      logGeo('info', `ipwho OK → ${code}`);
      return code;
    }
    throw new Error('ipwho: missing currency');
  } catch (e) {
    logGeo('warn', 'ipwho failed', e instanceof Error ? e.message : e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}
