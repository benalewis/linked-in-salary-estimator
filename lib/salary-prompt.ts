import type { SalaryEstimateInput } from '@/lib/salary-estimate-types';

/**
 * Build a user prompt for public-compensation reasoning. For Gemini, Google Search
 * grounding (when enabled in the API call) supplements this with fresh web results.
 */
function block(label: string, body: string | null | undefined): string {
  const t = (body ?? '').trim();
  return `${label}\n${t.length ? t : '(not available on this scrape)'}`;
}

export function buildSalaryEstimatePrompt(input: SalaryEstimateInput): string {
  const ccy = input.outputCurrency.trim().toUpperCase();
  const name = input.profileName ?? '(unknown)';
  const headline = input.headline ?? '(none)';
  const row = input.experienceRowText.trim() || '(empty)';
  const url = input.profileUrl.trim();

  const experienceFull = block(
    'Full Experience section (all roles visible on this profile page — public text)',
    input.experienceSectionText,
  );
  const education = block('Education section', input.educationSectionText);
  const skills = block('Skills section', input.skillsSectionText);
  const about = block('About section', input.aboutText);
  const certs = block('Certifications / licenses section', input.certificationsSectionText);
  const loc = block('Location line from profile card (if shown)', input.locationLine);

  return `You are estimating typical compensation for a professional role using only information that could appear on well-known public sources (for example: Glassdoor, Levels.fyi, Payscale, Indeed, LinkedIn Salary / workforce reports where cited as aggregates, company career pages that publish pay ranges, and SEC / regulatory filings for executive compensation). Do not claim access to private LinkedIn account data or this person's actual pay.

Question: How much does this person likely earn in their current role?

Profile display name: ${name}
Profile headline / tagline: ${headline}
Profile URL (context only): ${url}

${loc}

Primary Experience row for THIS estimate (the role row where the tool is focused — use as the primary job for salary):
${row}

${experienceFull}

${education}

${skills}

${about}

${certs}

Instructions:
1. Base the salary estimate primarily on the **primary Experience row** and headline; use the full Experience list, Education, Skills, About, and location as supporting context for seniority, field, and geography.
2. Ground your estimate in what those public salary indices and filings typically report for similar roles; if search tools ran, prefer recent third-party pages over stale training memory.
3. Express ALL monetary amounts ONLY in ${ccy} (ISO 4217). Convert from other currencies using reasonable approximate exchange rates and round to whole units for display currencies that typically use integers (e.g. JPY); otherwise round to the nearest whole currency unit.
4. salaryLow and salaryHigh are an estimated annual **cash base salary RANGE only** — exclude cash bonus and stock/equity from this band so it matches typical “base salary” reporting.
5. **totalComp** is estimated **annual total compensation** (TC): include **cash base** (conceptually aligned with the salaryLow–salaryHigh band), **plus typical annual cash bonus / variable cash** for this role level and region where applicable, **plus typical annualized value of recurring stock compensation** (e.g. RSUs or recurring option refreshers as commonly modeled in public comps such as Levels.fyi — approximate expected yearly vesting/value, not speculative one-off liquidation windfalls unless you clearly caveat in disclaimer). If equity is negligible or uncommon for this job family or geography in public data, omit or set that component near zero and state that briefly in disclaimer. Prefer underestimating uncertain equity over overstating.
6. List concrete source FAMILIES you relied on in sourcesUsed (e.g. "Levels.fyi — Software Engineer, SF Bay Area", "Glassdoor — Company salary reports") — not vague claims.

Return ONLY valid JSON with this exact shape and no markdown fences:
{"salaryLow":number,"salaryHigh":number,"totalComp":number,"currency":"${ccy}","confidence":"low"|"medium"|"high","sourcesUsed":string[],"disclaimer":string}

Ensure salaryLow <= salaryHigh. totalComp should reflect base + bonus + recurring stock components above; normally totalComp >= salaryLow when bonuses or equity norms apply, and MUST remain plausible versus public TC discussions for comparable roles.`;
}
