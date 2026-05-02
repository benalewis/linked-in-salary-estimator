import type { SalaryEstimateParsed } from '@/lib/salary-estimate-types';

function stripCodeFence(text: string): string {
  let s = text.trim();
  const m = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/m.exec(s);
  if (m) {
    return m[1]!.trim();
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    s = s.slice(start, end + 1);
  }
  return s.trim();
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function normalizeConfidence(raw: unknown): string {
  if (raw === 'low' || raw === 'medium' || raw === 'high') {
    return raw;
  }
  return typeof raw === 'string' ? raw : 'medium';
}

/** Parse and validate JSON returned by the model (with or without markdown fences). */
export function parseSalaryEstimateFromModelText(text: string): SalaryEstimateParsed | null {
  let s: string;
  try {
    s = stripCodeFence(text);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(s) as unknown;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const o = parsed as Record<string, unknown>;
  const salaryLow = o.salaryLow;
  const salaryHigh = o.salaryHigh;
  const totalComp = o.totalComp;
  const currency = o.currency;

  if (!isFiniteNumber(salaryLow) || !isFiniteNumber(salaryHigh) || !isFiniteNumber(totalComp)) {
    return null;
  }

  if (typeof currency !== 'string' || !/^[A-Z]{3}$/i.test(currency.trim())) {
    return null;
  }

  let sourcesUsed: string[] = [];
  if (Array.isArray(o.sourcesUsed)) {
    sourcesUsed = o.sourcesUsed.filter((x): x is string => typeof x === 'string').slice(0, 12);
  }

  const disclaimer = typeof o.disclaimer === 'string' ? o.disclaimer : 'Approximate public-market estimate only.';

  return {
    salaryLow,
    salaryHigh,
    totalComp,
    currency: currency.trim().toUpperCase(),
    confidence: normalizeConfidence(o.confidence),
    sourcesUsed,
    disclaimer,
  };
}
