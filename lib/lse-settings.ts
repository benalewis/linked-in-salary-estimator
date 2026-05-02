import browser from '@/lib/browser';
import { normalizeCurrencyCode } from '@/lib/currencies';
import { fetchGeoCurrencyFromNetwork } from '@/lib/lse-geo-fetch';

export const LSE_SETTINGS_KEY = 'lseSettings' as const;

/** Geo lookup (ipapi) is cached this long to limit API calls. */
export const GEO_LOOKUP_CACHE_MS = 86_400_000; // 1 day

export type LseSettings = {
  /** ISO 4217 code shown in the panel and future estimates */
  currencyCode: string;
  /** True when the user picked a currency; false when following geo default */
  currencyIsUserChoice: boolean;
  /** Last currency inferred from IP (for “use location” / status text) */
  geoCurrencyCode: string | null;
  /** Unix ms when ipapi last returned geo currency successfully (drives cache TTL). */
  geoLookupAt: number | null;
};

function logSettings(msg: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.info(`[salary-estimator] settings ${msg}`, detail);
  } else {
    console.info(`[salary-estimator] settings ${msg}`);
  }
}

/** Avoid overlapping geo upgrades when many tabs call getSettings at once. */
let geoUpgradeInProgress = false;

/** One extra ensureDefaultSettings retry per service-worker session when geo never succeeded. */
let sessionGeoRetryScheduled = false;

/**
 * Preference data uses `storage.local` so it works when Chrome Sync is off or over quota.
 * One-time migration: if local is empty but legacy `storage.sync` has settings, copy to local.
 */
async function readRawSettings(): Promise<unknown> {
  const localBag = await browser.storage.local.get(LSE_SETTINGS_KEY);
  let raw = localBag[LSE_SETTINGS_KEY];
  if (raw != null && typeof raw === 'object') {
    return raw;
  }
  const syncBag = await browser.storage.sync.get(LSE_SETTINGS_KEY);
  raw = syncBag[LSE_SETTINGS_KEY];
  if (raw != null && typeof raw === 'object') {
    await browser.storage.local.set({ [LSE_SETTINGS_KEY]: raw });
    return raw;
  }
  return undefined;
}

export async function readLseSettings(): Promise<LseSettings | null> {
  const v = await readRawSettings();
  if (!v || typeof v !== 'object') {
    return null;
  }
  const o = v as Partial<LseSettings>;
  if (typeof o.currencyCode !== 'string') {
    return null;
  }
  return {
    currencyCode: normalizeCurrencyCode(o.currencyCode),
    currencyIsUserChoice: Boolean(o.currencyIsUserChoice),
    geoCurrencyCode:
      typeof o.geoCurrencyCode === 'string' ? normalizeCurrencyCode(o.geoCurrencyCode) : null,
    geoLookupAt: typeof o.geoLookupAt === 'number' && Number.isFinite(o.geoLookupAt) ? o.geoLookupAt : null,
  };
}

export async function writeLseSettings(s: LseSettings): Promise<void> {
  await browser.storage.local.set({
    [LSE_SETTINGS_KEY]: s,
  });
}

function cacheFresh(settings: LseSettings | null, now: number): boolean {
  if (!settings?.geoCurrencyCode || settings.geoLookupAt == null) {
    return false;
  }
  return now - settings.geoLookupAt < GEO_LOOKUP_CACHE_MS;
}

/**
 * Resolves geo currency: uses stored lookup time if younger than {@link GEO_LOOKUP_CACHE_MS},
 * otherwise calls ipapi. On network failure, falls back to last known geo or USD.
 */
async function resolveGeoCurrency(opts: { ignoreCache: boolean }): Promise<{
  code: string;
  updatedLookupAt: number | null;
}> {
  const existing = await readLseSettings();
  const now = Date.now();

  if (!opts.ignoreCache && cacheFresh(existing, now) && existing!.geoCurrencyCode) {
    return { code: existing!.geoCurrencyCode, updatedLookupAt: existing!.geoLookupAt };
  }

  try {
    const code = normalizeCurrencyCode(await fetchGeoCurrencyFromNetwork());
    return { code, updatedLookupAt: now };
  } catch (e) {
    console.warn('[salary-estimator] settings geo network failed, using cache or USD', e);
    if (existing?.geoCurrencyCode) {
      return { code: existing.geoCurrencyCode, updatedLookupAt: existing.geoLookupAt };
    }
    return { code: 'USD', updatedLookupAt: null };
  }
}

/**
 * Persists defaults immediately so the content script never blocks on ipapi (slow/hung fetch = no panel).
 * Geo currency is filled asynchronously when possible.
 */
async function upgradeDefaultFromGeo(): Promise<void> {
  if (geoUpgradeInProgress) {
    return;
  }
  geoUpgradeInProgress = true;
  try {
    const { code, updatedLookupAt } = await resolveGeoCurrency({ ignoreCache: false });
    const cur = await readLseSettings();
    if (!cur || cur.currencyIsUserChoice) {
      return;
    }
    await writeLseSettings({
      currencyCode: code,
      currencyIsUserChoice: false,
      geoCurrencyCode: code,
      geoLookupAt: updatedLookupAt,
    });
    logSettings('geo upgrade applied', { currencyCode: code, geoLookupAt: updatedLookupAt });
  } finally {
    geoUpgradeInProgress = false;
  }
}

/** If nothing stored yet, save USD immediately and resolve geo in the background. Otherwise returns existing. */
export async function ensureDefaultSettings(): Promise<LseSettings> {
  const existing = await readLseSettings();
  if (existing) {
    if (
      !existing.currencyIsUserChoice &&
      existing.geoLookupAt == null &&
      !sessionGeoRetryScheduled
    ) {
      sessionGeoRetryScheduled = true;
      logSettings('re-trying geo (no successful lookup yet)');
      void upgradeDefaultFromGeo();
    }
    return existing;
  }

  const provisional: LseSettings = {
    currencyCode: 'USD',
    currencyIsUserChoice: false,
    geoCurrencyCode: null,
    geoLookupAt: null,
  };
  await writeLseSettings(provisional);
  void upgradeDefaultFromGeo();
  return provisional;
}

export async function setUserCurrency(code: string): Promise<void> {
  const normalized = normalizeCurrencyCode(code);
  const existing = await readLseSettings();
  await writeLseSettings({
    currencyCode: normalized,
    currencyIsUserChoice: true,
    geoCurrencyCode: existing?.geoCurrencyCode ?? null,
    geoLookupAt: existing?.geoLookupAt ?? null,
  });
}

/** Re-fetch IP-based currency when cache allows; switch display to geo default. */
export async function applyGeoCurrency(): Promise<LseSettings> {
  const { code, updatedLookupAt } = await resolveGeoCurrency({ ignoreCache: false });
  const s: LseSettings = {
    currencyCode: code,
    currencyIsUserChoice: false,
    geoCurrencyCode: code,
    geoLookupAt: updatedLookupAt,
  };
  await writeLseSettings(s);
  return s;
}
