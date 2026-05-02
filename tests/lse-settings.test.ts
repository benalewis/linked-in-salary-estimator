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
  readLseSettings,
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
    expect((localStore[LSE_SETTINGS_KEY] as { currencyCode: string }).currencyCode).toBe('USD');
  });

  it('returns stored currency without overwriting', async () => {
    localStore[LSE_SETTINGS_KEY] = { currencyCode: 'EUR' };
    const s = await ensureDefaultSettings();
    expect(s.currencyCode).toBe('EUR');
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
    expect(localStore[LSE_SETTINGS_KEY]).toEqual(syncStore[LSE_SETTINGS_KEY]);
  });
});

describe('setUserCurrency', () => {
  beforeEach(() => clearStores());

  it('stores normalized code and persists only currency field shape', async () => {
    localStore[LSE_SETTINGS_KEY] = {
      currencyCode: 'USD',
      currencyIsUserChoice: false,
      geoCurrencyCode: 'EUR',
      geoLookupAt: 1,
    };
    await setUserCurrency('gbp');
    const s = await readLseSettings();
    expect(s?.currencyCode).toBe('GBP');
    expect(localStore[LSE_SETTINGS_KEY]).toEqual({ currencyCode: 'GBP' });
  });
});
