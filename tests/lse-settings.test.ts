import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LSE_SETTINGS_KEY } from '@/lib/lse-settings';

const { localStore, syncStore } = vi.hoisted(() => {
  const localStore: Record<string, unknown> = {};
  const syncStore: Record<string, unknown> = {};
  return { localStore, syncStore };
});

vi.mock('@/lib/browser', () => ({
  default: {
    storage: {
      local: {
        get: async (keys: string) => ({ [keys]: localStore[keys] }),
        set: async (items: Record<string, unknown>) => {
          Object.assign(localStore, items);
        },
      },
      sync: {
        get: async (keys: string) => ({ [keys]: syncStore[keys] }),
        set: async (items: Record<string, unknown>) => {
          Object.assign(syncStore, items);
        },
      },
    },
  },
}));

import {
  ensureDefaultSettings,
  normalizeEstimateRunMode,
  readLseSettings,
  setEstimateRunMode,
  setUserCurrency,
} from '@/lib/lse-settings';

function clearStores() {
  for (const k of Object.keys(localStore)) {
    delete localStore[k];
  }
  for (const k of Object.keys(syncStore)) {
    delete syncStore[k];
  }
}

describe('ensureDefaultSettings', () => {
  beforeEach(() => clearStores());

  afterEach(() => vi.unstubAllGlobals());

  it('writes USD when nothing stored', async () => {
    const s = await ensureDefaultSettings();
    expect(s.currencyCode).toBe('USD');
    expect(s.estimateRunMode).toBe('manual');
    expect(localStore[LSE_SETTINGS_KEY]).toEqual({ currencyCode: 'USD', estimateRunMode: 'manual' });
  });

  it('returns stored currency and persists canonical estimateRunMode when missing', async () => {
    localStore[LSE_SETTINGS_KEY] = { currencyCode: 'EUR' };
    const s = await ensureDefaultSettings();
    expect(s.currencyCode).toBe('EUR');
    expect(s.estimateRunMode).toBe('manual');
    expect(localStore[LSE_SETTINGS_KEY]).toEqual({ currencyCode: 'EUR', estimateRunMode: 'manual' });
  });

  it('rewrites invalid stored estimateRunMode to canonical manual', async () => {
    localStore[LSE_SETTINGS_KEY] = { currencyCode: 'USD', estimateRunMode: 'junk' };
    const s = await ensureDefaultSettings();
    expect(s.estimateRunMode).toBe('manual');
    expect(localStore[LSE_SETTINGS_KEY]).toEqual({ currencyCode: 'USD', estimateRunMode: 'manual' });
  });

  it('migrates legacy sync blob into local and reads currencyCode', async () => {
    syncStore[LSE_SETTINGS_KEY] = {
      currencyCode: 'CAD',
      currencyIsUserChoice: true,
      geoCurrencyCode: 'CAD',
      geoLookupAt: null,
    };
    const s = await readLseSettings();
    expect(s?.currencyCode).toBe('CAD');
    expect(s?.estimateRunMode).toBe('manual');
    expect(localStore[LSE_SETTINGS_KEY]).toEqual(syncStore[LSE_SETTINGS_KEY]);
  });
});

describe('normalizeEstimateRunMode', () => {
  it("treats only literal 'auto' as auto", () => {
    expect(normalizeEstimateRunMode('auto')).toBe('auto');
    expect(normalizeEstimateRunMode('manual')).toBe('manual');
    expect(normalizeEstimateRunMode(undefined)).toBe('manual');
    expect(normalizeEstimateRunMode('Auto')).toBe('manual');
    expect(normalizeEstimateRunMode('junk')).toBe('manual');
  });
});

describe('setUserCurrency', () => {
  beforeEach(() => clearStores());

  it('stores normalized code and retains estimateRunMode', async () => {
    localStore[LSE_SETTINGS_KEY] = {
      currencyCode: 'USD',
      currencyIsUserChoice: false,
      geoCurrencyCode: 'EUR',
      geoLookupAt: 1,
      estimateRunMode: 'auto',
    };
    await setUserCurrency('gbp');
    const s = await readLseSettings();
    expect(s?.currencyCode).toBe('GBP');
    expect(s?.estimateRunMode).toBe('auto');
    expect(localStore[LSE_SETTINGS_KEY]).toEqual({ currencyCode: 'GBP', estimateRunMode: 'auto' });
  });
});

describe('setEstimateRunMode', () => {
  beforeEach(() => clearStores());

  it('persists manual and auto alongside currency', async () => {
    localStore[LSE_SETTINGS_KEY] = { currencyCode: 'CHF', estimateRunMode: 'manual' };
    await setEstimateRunMode('auto');
    expect(await readLseSettings()).toEqual({
      currencyCode: 'CHF',
      estimateRunMode: 'auto',
    });
    await setEstimateRunMode('manual');
    expect(await readLseSettings()).toEqual({
      currencyCode: 'CHF',
      estimateRunMode: 'manual',
    });
  });

  it('treats invalid stored estimateRunMode as manual on read', async () => {
    localStore[LSE_SETTINGS_KEY] = { currencyCode: 'USD', estimateRunMode: 'junk' };
    expect((await readLseSettings())?.estimateRunMode).toBe('manual');
  });
});
