import { describe, expect, it } from 'vitest';
import { CURRENCY_OPTIONS, formatMoney, isOfferedCurrency, normalizeCurrencyCode } from '@/lib/currencies';

describe('normalizeCurrencyCode', () => {
  it('uppercases valid ISO codes', () => {
    expect(normalizeCurrencyCode('eur')).toBe('EUR');
    expect(normalizeCurrencyCode(' USD ')).toBe('USD');
  });

  it('falls back to USD for invalid input', () => {
    expect(normalizeCurrencyCode('')).toBe('USD');
    expect(normalizeCurrencyCode('XX')).toBe('USD');
    expect(normalizeCurrencyCode('USDD')).toBe('USD');
  });
});

describe('isOfferedCurrency', () => {
  it('recognizes listed codes', () => {
    expect(isOfferedCurrency('USD')).toBe(true);
    expect(isOfferedCurrency('XXX')).toBe(false);
  });
});

describe('CURRENCY_OPTIONS', () => {
  it('has unique codes', () => {
    const codes = CURRENCY_OPTIONS.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('formatMoney', () => {
  it('formats with Intl for known currency', () => {
    const s = formatMoney(120_000, 'USD');
    expect(s).toMatch(/120/);
    expect(s).toMatch(/USD|\$/);
  });
});
