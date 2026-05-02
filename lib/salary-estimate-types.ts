/** Input scraped from the LinkedIn profile page for LLM salary estimation. */

export type SalaryEstimateInput = {
  profileName: string | null;
  headline: string | null;
  experienceRowText: string;
  profileUrl: string;
  outputCurrency: string;
  /** Correlates content-script → background → worker logs for one estimate. */
  requestId?: string;
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
