import { describe, expect, it } from 'vitest';
import { upgradeDeprecatedGeminiModel } from '@/lib/llm-gemini-model';

describe('upgradeDeprecatedGeminiModel', () => {
  it('maps deprecated 2.0 Flash ids to 2.5', () => {
    expect(upgradeDeprecatedGeminiModel('gemini-2.0-flash')).toBe('gemini-2.5-flash');
    expect(upgradeDeprecatedGeminiModel('gemini-2.0-flash-001')).toBe('gemini-2.5-flash');
    expect(upgradeDeprecatedGeminiModel('gemini-2.0-flash-lite')).toBe('gemini-2.5-flash-lite');
  });

  it('leaves current models unchanged', () => {
    expect(upgradeDeprecatedGeminiModel('gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(upgradeDeprecatedGeminiModel('gemini-1.5-flash')).toBe('gemini-1.5-flash');
  });
});
