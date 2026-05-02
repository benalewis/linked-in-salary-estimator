import { describe, expect, it } from 'vitest';
import { friendlyLlmErrorMessage } from '@/lib/llm-user-errors';

describe('friendlyLlmErrorMessage', () => {
  it('summarizes quota-related API errors', () => {
    const raw =
      'You exceeded your current quota, please check your plan and billing details.';
    const out = friendlyLlmErrorMessage(raw);
    expect(out).toMatch(/Quota|billing/i);
    expect(out).not.toContain('read the docs');
  });

  it('keeps unknown errors but truncates very long strings', () => {
    const long = 'x'.repeat(400);
    expect(friendlyLlmErrorMessage(long).length).toBeLessThanOrEqual(280);
  });
});
