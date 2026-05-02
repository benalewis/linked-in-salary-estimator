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
  applyGeoCurrency,
  ensureDefaultSettings,
  GEO_LOOKUP_CACHE_MS,
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
  beforeEach(() => {
    clearStores();
    vi.restoreAllMocks();
    /** Avoid real network when ensure re-tries geo (session retry path). */
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('tests: default fetch disabled')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes provisional USD to local storage immediately', async () => {
    const s = await ensureDefaultSettings();
    expect(s.currencyCode).toBe('USD');
    expect(s.currencyIsUserChoice).toBe(false);
    expect(localStore[LSE_SETTINGS_KEY]).toBeDefined();
  });

  it('returns existing settings without overwriting', async () => {
    await ensureDefaultSettings();
    const again = await ensureDefaultSettings();
    expect(again.currencyCode).toBe('USD');
  });

  it('migrates legacy sync settings into local when local is empty', async () => {
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

  it('upgrades provisional defaults when fetch returns currency', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ currency: 'jpy' }),
      }),
    );

    await ensureDefaultSettings();

    await vi.waitFor(
      async () => {
        const cur = await readLseSettings();
        expect(cur?.currencyCode).toBe('JPY');
      },
      { timeout: 3000 },
    );
  });

  it('does not upgrade when user already chose a currency', async () => {
    localStore[LSE_SETTINGS_KEY] = {
      currencyCode: 'CHF',
      currencyIsUserChoice: true,
      geoCurrencyCode: null,
      geoLookupAt: null,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ currency: 'usd' }),
      }),
    );

    await ensureDefaultSettings();

    await new Promise((r) => setTimeout(r, 50));
    const cur = await readLseSettings();
    expect(cur?.currencyCode).toBe('CHF');
  });
});

describe('setUserCurrency', () => {
  beforeEach(() => {
    clearStores();
  });

  it('marks user choice and preserves geo metadata when present', async () => {
    localStore[LSE_SETTINGS_KEY] = {
      currencyCode: 'USD',
      currencyIsUserChoice: false,
      geoCurrencyCode: 'EUR',
      geoLookupAt: 1,
    };
    await setUserCurrency('GBP');
    const s = await readLseSettings();
    expect(s?.currencyCode).toBe('GBP');
    expect(s?.currencyIsUserChoice).toBe(true);
    expect(s?.geoCurrencyCode).toBe('EUR');
  });
});

describe('applyGeoCurrency', () => {
  beforeEach(() => {
    clearStores();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses cache and skips fetch when lookup is fresh', async () => {
    const t = Date.now();
    localStore[LSE_SETTINGS_KEY] = {
      currencyCode: 'EUR',
      currencyIsUserChoice: false,
      geoCurrencyCode: 'EUR',
      geoLookupAt: t,
    };

    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await applyGeoCurrency();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls fetch when cache is stale', async () => {
    localStore[LSE_SETTINGS_KEY] = {
      currencyCode: 'EUR',
      currencyIsUserChoice: false,
      geoCurrencyCode: 'EUR',
      geoLookupAt: Date.now() - GEO_LOOKUP_CACHE_MS - 60_000,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ currency: 'sek' }),
      }),
    );

    const s = await applyGeoCurrency();
    expect(s.currencyCode).toBe('SEK');
  });
});
