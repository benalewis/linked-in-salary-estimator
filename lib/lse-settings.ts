import browser from '@/lib/browser';
import { normalizeCurrencyCode } from '@/lib/currencies';

export const LSE_SETTINGS_KEY = 'lseSettings' as const;

/** Display currency for the panel and estimates — user-chosen, persisted in storage.local. */
export type LseSettings = {
  currencyCode: string;
};

/**
 * Preference data uses `storage.local` so it works when Chrome Sync is off or over quota.
 * One-time migration: if local is empty but legacy `storage.sync` has settings, copy to local.
 * Legacy objects may include geo fields; only `currencyCode` is read.
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
  const o = v as { currencyCode?: unknown };
  if (typeof o.currencyCode !== 'string') {
    return null;
  }
  return { currencyCode: normalizeCurrencyCode(o.currencyCode) };
}

export async function writeLseSettings(s: LseSettings): Promise<void> {
  await browser.storage.local.set({
    [LSE_SETTINGS_KEY]: { currencyCode: normalizeCurrencyCode(s.currencyCode) },
  });
}

/** If nothing stored yet, save USD. Otherwise return existing (last user choice or migrated record). */
export async function ensureDefaultSettings(): Promise<LseSettings> {
  const existing = await readLseSettings();
  if (existing) {
    return existing;
  }

  const provisional: LseSettings = { currencyCode: 'USD' };
  await writeLseSettings(provisional);
  return provisional;
}

export async function setUserCurrency(code: string): Promise<void> {
  await writeLseSettings({ currencyCode: normalizeCurrencyCode(code) });
}
