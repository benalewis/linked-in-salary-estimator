import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGeoCurrencyFromNetwork } from '@/lib/lse-geo-fetch';

describe('fetchGeoCurrencyFromNetwork', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns currency from ipapi on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ currency: 'nzd' }),
      }),
    );
    await expect(fetchGeoCurrencyFromNetwork()).resolves.toBe('NZD');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to ipwho when ipapi fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: RequestInfo) => {
        const u = String(url);
        if (u.includes('ipapi.co')) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: async () => ({}),
          });
        }
        if (u.includes('ipwho.is')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, currency: { code: 'sek' } }),
          });
        }
        return Promise.reject(new Error(`unexpected url ${u}`));
      }),
    );

    await expect(fetchGeoCurrencyFromNetwork()).resolves.toBe('SEK');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws when both providers fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
    );

    await expect(fetchGeoCurrencyFromNetwork()).rejects.toBeDefined();
  });
});
