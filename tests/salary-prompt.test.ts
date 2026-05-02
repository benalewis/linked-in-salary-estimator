import { describe, expect, it } from 'vitest';
import { buildSalaryEstimatePrompt } from '@/lib/salary-prompt';
import type { SalaryEstimateInput } from '@/lib/salary-estimate-types';

describe('buildSalaryEstimatePrompt', () => {
  it('includes section blocks when present', () => {
    const input: SalaryEstimateInput = {
      profileName: 'A',
      headline: 'H',
      experienceRowText: 'Row',
      profileUrl: 'https://www.linkedin.com/in/x/',
      outputCurrency: 'GBP',
      experienceSectionText: 'Exp block',
      educationSectionText: 'Edu block',
    };
    const p = buildSalaryEstimatePrompt(input);
    expect(p).toContain('Exp block');
    expect(p).toContain('Edu block');
    expect(p).toContain('Primary Experience row for THIS estimate');
    expect(p).toContain('annual total compensation');
    expect(p).toContain('cash bonus');
    expect(p).toContain('stock');
  });
});
