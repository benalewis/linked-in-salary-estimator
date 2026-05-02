import browser from '@/lib/browser';
import { normalizeCurrencyCode } from '@/lib/currencies';
import type { SalaryEstimateParsed } from '@/lib/salary-estimate-types';

export const SALARY_ESTIMATE_CACHE_PREFIX = 'lseEstV1:' as const;

/** One month — salary cache TTL (ms). */
export const SALARY_ESTIMATE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type CachedSalaryEstimateRecord = {
  storedAtMs: number;
  estimate: SalaryEstimateParsed;
  displayCurrencyCode: string;
};

/** Canonical profile path for cache keys: `host` + pathname, no query/hash, lowercased. */
export function normalizeProfileUrlForCache(hrefOrPath: string): string {
  try {
    const joined = hrefOrPath.includes('://')
      ? hrefOrPath
      : `https://www.linkedin.com${hrefOrPath.startsWith('/') ? '' : '/'}${hrefOrPath}`;
    const u = new URL(joined);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const pathRaw = u.pathname.replace(/\/+$/, '') || '/';
    return `${host}${pathRaw.toLowerCase()}`;
  } catch {
    return hrefOrPath.trim().toLowerCase();
  }
}

export function fingerprintExperienceRow(rowText: string): string {
  return rowText.replace(/\s+/g, ' ').trim();
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function salaryEstimateStorageKey(
  canonicalProfileUrl: string,
  experienceFingerprint: string,
  displayCurrencyCode: string,
): Promise<string> {
  const ccy = normalizeCurrencyCode(displayCurrencyCode).toUpperCase();
  const canonical = `${canonicalProfileUrl}\n${experienceFingerprint}\n${ccy}`;
  const hex = await sha256Hex(canonical);
  return `${SALARY_ESTIMATE_CACHE_PREFIX}${hex}`;
}

export async function readCachedSalaryEstimate(
  profileHref: string,
  experienceRowText: string,
  displayCurrencyCode: string,
): Promise<SalaryEstimateParsed | null> {
  const pu = normalizeProfileUrlForCache(profileHref);
  const ef = fingerprintExperienceRow(experienceRowText);
  const key = await salaryEstimateStorageKey(pu, ef, displayCurrencyCode);
  const got = await browser.storage.local.get(key);
  const row = got[key as keyof typeof got] as CachedSalaryEstimateRecord | undefined;
  if (!row?.estimate || typeof row.storedAtMs !== 'number') {
    return null;
  }
  if (Date.now() - row.storedAtMs > SALARY_ESTIMATE_CACHE_TTL_MS) {
    void browser.storage.local.remove(key);
    return null;
  }
  const want = normalizeCurrencyCode(displayCurrencyCode).toUpperCase();
  const have = normalizeCurrencyCode(row.displayCurrencyCode).toUpperCase();
  if (want !== have) {
    return null;
  }
  return row.estimate;
}

export async function writeCachedSalaryEstimate(
  profileHref: string,
  experienceRowText: string,
  displayCurrencyCode: string,
  estimate: SalaryEstimateParsed,
): Promise<void> {
  const pu = normalizeProfileUrlForCache(profileHref);
  const ef = fingerprintExperienceRow(experienceRowText);
  const key = await salaryEstimateStorageKey(pu, ef, displayCurrencyCode);
  const payload: CachedSalaryEstimateRecord = {
    storedAtMs: Date.now(),
    estimate,
    displayCurrencyCode: normalizeCurrencyCode(displayCurrencyCode).toUpperCase(),
  };
  await browser.storage.local.set({ [key]: payload });
}
