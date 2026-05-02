import { describe, expect, it } from 'vitest';
import { LSE_PANEL_ATTR, mutationsAreOnlyInsideSalaryPanel } from '@/lib/linkedin-panel';

describe('mutationsAreOnlyInsideSalaryPanel', () => {
  it('returns false when a mutation targets document body', () => {
    const m = { target: document.body } as MutationRecord;
    expect(mutationsAreOnlyInsideSalaryPanel([m])).toBe(false);
  });

  it('returns true when all targets are inside the salary panel', () => {
    const wrap = document.createElement('div');
    wrap.setAttribute(LSE_PANEL_ATTR, '');
    const inner = document.createElement('span');
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    const m = { target: inner } as MutationRecord;
    expect(mutationsAreOnlyInsideSalaryPanel([m])).toBe(true);
    wrap.remove();
  });

  it('returns false for empty list', () => {
    expect(mutationsAreOnlyInsideSalaryPanel([])).toBe(false);
  });
});
