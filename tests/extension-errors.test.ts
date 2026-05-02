import { describe, expect, it } from 'vitest';
import { formatExtensionSideError } from '@/lib/extension-errors';

describe('formatExtensionSideError', () => {
  it('explains extension reload and asks for refresh', () => {
    expect(formatExtensionSideError('Error: Extension context invalidated.')).toMatch(/Refresh this page \(F5\)/);
  });

  it('leaves unrelated messages unchanged', () => {
    expect(formatExtensionSideError('API key missing')).toBe('API key missing');
  });
});
