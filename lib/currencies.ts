/** Curated list for the popup; any valid ISO 4217 code from geolocation is still accepted. */

export type CurrencyOption = { code: string; label: string };

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'USD', label: 'USD — US dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — Pound sterling' },
  { code: 'JPY', label: 'JPY — Japanese yen' },
  { code: 'CNY', label: 'CNY — Chinese yuan' },
  { code: 'INR', label: 'INR — Indian rupee' },
  { code: 'CAD', label: 'CAD — Canadian dollar' },
  { code: 'AUD', label: 'AUD — Australian dollar' },
  { code: 'CHF', label: 'CHF — Swiss franc' },
  { code: 'SEK', label: 'SEK — Swedish krona' },
  { code: 'NOK', label: 'NOK — Norwegian krone' },
  { code: 'DKK', label: 'DKK — Danish krone' },
  { code: 'NZD', label: 'NZD — New Zealand dollar' },
  { code: 'SGD', label: 'SGD — Singapore dollar' },
  { code: 'HKD', label: 'HKD — Hong Kong dollar' },
  { code: 'KRW', label: 'KRW — South Korean won' },
  { code: 'MXN', label: 'MXN — Mexican peso' },
  { code: 'BRL', label: 'BRL — Brazilian real' },
  { code: 'ZAR', label: 'ZAR — South African rand' },
  { code: 'PLN', label: 'PLN — Polish złoty' },
  { code: 'TRY', label: 'TRY — Turkish lira' },
  { code: 'AED', label: 'AED — UAE dirham' },
  { code: 'SAR', label: 'SAR — Saudi riyal' },
  { code: 'ILS', label: 'ILS — Israeli shekel' },
  { code: 'CZK', label: 'CZK — Czech koruna' },
  { code: 'HUF', label: 'HUF — Hungarian forint' },
  { code: 'RON', label: 'RON — Romanian leu' },
  { code: 'THB', label: 'THB — Thai baht' },
  { code: 'MYR', label: 'MYR — Malaysian ringgit' },
  { code: 'PHP', label: 'PHP — Philippine peso' },
  { code: 'IDR', label: 'IDR — Indonesian rupiah' },
  { code: 'TWD', label: 'TWD — New Taiwan dollar' },
];

const codes = new Set(CURRENCY_OPTIONS.map((c) => c.code));

export function normalizeCurrencyCode(raw: string): string {
  const u = raw.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(u)) {
    return u;
  }
  return 'USD';
}

export function isOfferedCurrency(code: string): boolean {
  return codes.has(code);
}

/** Format an amount when real estimates exist; safe for display. */
export function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(0)}`;
  }
}
