import type { SalaryEstimateInput } from '@/lib/salary-estimate-types';

/**
 * Build a user prompt for public-compensation reasoning. For Gemini, Google Search
 * grounding (when enabled in the API call) supplements this with fresh web results.
 */
export function buildSalaryEstimatePrompt(input: SalaryEstimateInput): string {
  const ccy = input.outputCurrency.trim().toUpperCase();
  const name = input.profileName ?? '(unknown)';
  const headline = input.headline ?? '(none)';
  const row = input.experienceRowText.trim() || '(empty)';
  const url = input.profileUrl.trim();

  return `You are estimating typical compensation for a professional role using only information that could appear on well-known public sources (for example: Glassdoor, Levels.fyi, Payscale, Indeed, LinkedIn Salary / workforce reports where cited as aggregates, company career pages that publish pay ranges, and SEC / regulatory filings for executive compensation). Do not claim access to private LinkedIn account data or this person's actual pay.

Question: How much does this person likely earn in their current role?

Profile display name: ${name}
Profile headline / tagline: ${headline}
Primary Experience row text (current role context): ${row}
Profile URL (context only): ${url}

Instructions:
1. Infer job title, employer, seniority, and location from the text above when possible.
2. Ground your estimate in what those public salary indices and filings typically report for similar roles; if search tools ran, prefer recent third-party pages over stale training memory.
3. Express ALL monetary amounts ONLY in ${ccy} (ISO 4217). Convert from other currencies using reasonable approximate exchange rates and round to whole units for display currencies that typically use integers (e.g. JPY); otherwise round to the nearest whole currency unit.
4. salaryLow and salaryHigh are an estimated base salary RANGE (cash base only) for this role/level/region.
5. totalComp is estimated annual total compensation including typical bonus and recurring cash incentives for this role (exclude one-off equity gains unless equity is the dominant reported TC for that benchmark — then approximate expected annual value conservatively and say so in disclaimer).
6. List concrete source FAMILIES you relied on in sourcesUsed (e.g. "Levels.fyi — Software Engineer, SF Bay Area", "Glassdoor — Company salary reports") — not vague claims.

Return ONLY valid JSON with this exact shape and no markdown fences:
{"salaryLow":number,"salaryHigh":number,"totalComp":number,"currency":"${ccy}","confidence":"low"|"medium"|"high","sourcesUsed":string[],"disclaimer":string}

Ensure salaryLow <= salaryHigh and totalComp is plausible vs the base range for the role.`;
}
