import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cacheBucket = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('@/lib/browser', () => ({
  default: {
    storage: {
      local: {
        get: async (keys: string | Record<string, unknown> | string[] | null) => {
          if (typeof keys === 'string') {
            const v = cacheBucket[keys];
            return v !== undefined ? { [keys]: v } : {};
          }
          return {};
        },
        set: async (items: Record<string, unknown>) => {
          Object.assign(cacheBucket, items);
        },
        remove: async (keys: string | string[]) => {
          const list = typeof keys === 'string' ? [keys] : keys;
          for (const k of list) {
            delete cacheBucket[k];
          }
        },
      },
    },
  },
}));

import {
  fingerprintExperienceRow,
  normalizeProfileUrlForCache,
  readCachedSalaryEstimate,
  SALARY_ESTIMATE_CACHE_TTL_MS,
  salaryEstimateStorageKey,
  writeCachedSalaryEstimate,
} from '@/lib/salary-estimate-cache';

describe('salary-estimate-cache', () => {
  beforeEach(() => {
    for (const k of Object.keys(cacheBucket)) {
      delete cacheBucket[k];
    }
    vi.spyOn(Date, 'now').mockReturnValue(1_735_689_600_000); // fixed epoch-like ms
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes LinkedIn URLs to host+pathname without trailing slash', () => {
    expect(normalizeProfileUrlForCache('https://www.linkedin.com/in/Some-One/')).toBe('linkedin.com/in/some-one');
    expect(normalizeProfileUrlForCache('https://Linkedin.com/in/x?trk=x')).toBe('linkedin.com/in/x');
  });

  it('fingerprints Experience row text with collapsed whitespace', () => {
    expect(fingerprintExperienceRow('  Foo\n  Bar\t  ')).toBe('Foo Bar');
  });

  it('round-trips estimates under the same composite key', async () => {
    const est = {
      salaryLow: 100,
      salaryHigh: 200,
      totalComp: 240,
      currency: 'GBP',
      confidence: 'medium',
      sourcesUsed: [],
      disclaimer: '',
    };
    await writeCachedSalaryEstimate('https://www.linkedin.com/in/a/', '  Role · Co  ', 'gbp', est);
    expect(Object.keys(cacheBucket).length).toBe(1);
    const fresh = await readCachedSalaryEstimate('https://www.linkedin.com/in/a/', 'Role · Co', 'GBP');
    expect(fresh?.totalComp).toBe(240);
  });

  it('expires entries after TTL', async () => {
    const est = {
      salaryLow: 1,
      salaryHigh: 2,
      totalComp: 3,
      currency: 'USD',
      confidence: 'low',
      sourcesUsed: [],
      disclaimer: '',
    };
    await writeCachedSalaryEstimate('https://linkedin.com/in/b/', 'R', 'USD', est);
    const key = (await salaryEstimateStorageKey(normalizeProfileUrlForCache('/in/b/'), 'R', 'USD')) as keyof typeof cacheBucket;

    vi.spyOn(Date, 'now').mockReturnValue(1_735_689_600_000 + SALARY_ESTIMATE_CACHE_TTL_MS + 1);

    expect(await readCachedSalaryEstimate('/in/b/', 'R', 'USD')).toBeNull();
    expect(cacheBucket[key]).toBeUndefined();
  });
});
