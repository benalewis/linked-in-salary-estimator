import browser from '@/lib/browser';
import { normalizeCurrencyCode } from '@/lib/currencies';

export const LSE_SETTINGS_KEY = 'lseSettings' as const;

/** `'manual'`: panel shows Run; `'auto'`: estimate starts after inject (respects Gemini enable/key). */
export type EstimateRunMode = 'manual' | 'auto';

/** Display currency and estimate trigger behaviour — persisted in storage.local. */
export type LseSettings = {
  currencyCode: string;
  estimateRunMode: EstimateRunMode;
};

/**
 * Preference data uses `storage.local` so it works when Chrome Sync is off or over quota.
 * One-time migration: if local is empty but legacy `storage.sync` has settings, copy to local.
 * Legacy objects may include geo fields; only `currencyCode` is read.
 */
function normalizeEstimateRunMode(v: unknown): EstimateRunMode {
  return v === 'auto' ? 'auto' : 'manual';
}

export function normalizeLseSettingsRow(o: Record<string, unknown>): LseSettings {
  return {
    currencyCode:
      typeof o.currencyCode === 'string' ? normalizeCurrencyCode(o.currencyCode) : 'USD',
    estimateRunMode: normalizeEstimateRunMode(o.estimateRunMode),
  };
}

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
  const o = v as Record<string, unknown>;
  if (typeof o.currencyCode !== 'string') {
    return null;
  }
  return normalizeLseSettingsRow(o);
}

export async function writeLseSettings(s: LseSettings): Promise<void> {
  await browser.storage.local.set({
    [LSE_SETTINGS_KEY]: {
      currencyCode: normalizeCurrencyCode(s.currencyCode),
      estimateRunMode: s.estimateRunMode === 'auto' ? 'auto' : 'manual',
    },
  });
}

/** If nothing stored yet, save USD + manual mode. Otherwise return existing (last user choice or migrated record). */
export async function ensureDefaultSettings(): Promise<LseSettings> {
  const existing = await readLseSettings();
  if (existing) {
    return existing;
  }

  const provisional: LseSettings = { currencyCode: 'USD', estimateRunMode: 'manual' };
  await writeLseSettings(provisional);
  return provisional;
}

export async function setUserCurrency(code: string): Promise<void> {
  const cur = await ensureDefaultSettings();
  await writeLseSettings({ ...cur, currencyCode: normalizeCurrencyCode(code) });
}

export async function setEstimateRunMode(mode: EstimateRunMode): Promise<void> {
  const cur = await ensureDefaultSettings();
  await writeLseSettings({ ...cur, estimateRunMode: mode });
}
