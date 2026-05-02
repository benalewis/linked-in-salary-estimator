import { describe, expect, it } from 'vitest';
import { parseSalaryEstimateFromModelText } from '@/lib/salary-parse';

describe('parseSalaryEstimateFromModelText', () => {
  it('parses raw JSON', () => {
    const t = `{"salaryLow":100000,"salaryHigh":130000,"totalComp":150000,"currency":"USD","confidence":"medium","sourcesUsed":["Levels.fyi — SWE"],"disclaimer":"Approximate."}`;
    const p = parseSalaryEstimateFromModelText(t);
    expect(p).toEqual({
      salaryLow: 100_000,
      salaryHigh: 130_000,
      totalComp: 150_000,
      currency: 'USD',
      confidence: 'medium',
      sourcesUsed: ['Levels.fyi — SWE'],
      disclaimer: 'Approximate.',
    });
  });

  it('strips markdown fences', () => {
    const t = '```json\n{"salaryLow":1,"salaryHigh":2,"totalComp":3,"currency":"EUR","confidence":"low","sourcesUsed":[],"disclaimer":"x"}\n```';
    const p = parseSalaryEstimateFromModelText(t);
    expect(p?.currency).toBe('EUR');
    expect(p?.salaryLow).toBe(1);
  });

  it('rejects invalid currency', () => {
    const p = parseSalaryEstimateFromModelText(
      '{"salaryLow":1,"salaryHigh":2,"totalComp":3,"currency":"US","confidence":"low","sourcesUsed":[],"disclaimer":""}',
    );
    expect(p).toBeNull();
  });
});
