/** Input scraped from the LinkedIn profile page for LLM salary estimation. */

export type SalaryEstimateInput = {
  profileName: string | null;
  headline: string | null;
  /** Text from the specific Experience row where the panel is attached (current-role focus). */
  experienceRowText: string;
  profileUrl: string;
  outputCurrency: string;
  /** Correlates content-script → background → worker logs for one estimate. */
  requestId?: string;
  /** Full Experience section copy when scraped from the open profile (all roles). */
  experienceSectionText?: string | null;
  educationSectionText?: string | null;
  skillsSectionText?: string | null;
  aboutText?: string | null;
  certificationsSectionText?: string | null;
  /** Location / geo line from the top card when found. */
  locationLine?: string | null;
};

/** Parsed model JSON (amounts in outputCurrency). */
export type SalaryEstimateParsed = {
  salaryLow: number;
  salaryHigh: number;
  totalComp: number;
  currency: string;
  confidence: 'low' | 'medium' | 'high' | string;
  sourcesUsed: string[];
  disclaimer: string;
};

export type SalaryEstimateWorkerResult =
  | { ok: true; estimate: SalaryEstimateParsed }
  | { ok: false; error: string };
