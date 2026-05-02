import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findExperiencePanelMount,
  isProfilePath,
  LSE_PANEL_ATTR,
  removeSalaryPanel,
  tryInjectSalaryPanel,
} from '@/lib/linkedin-panel';

function stubLocation(pathname: string) {
  const href = `https://www.linkedin.com${pathname}`;
  vi.stubGlobal(
    'location',
    {
      pathname,
      href,
    } as Location,
  );
}

describe('isProfilePath', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('matches /in/{slug}/', () => {
    stubLocation('/in/someone/');
    expect(isProfilePath()).toBe(true);
  });

  it('rejects non-profile paths', () => {
    stubLocation('/feed/');
    expect(isProfilePath()).toBe(false);
  });
});

describe('findExperiencePanelMount', () => {
  it('prefers LinkedIn-style inner text column when present', () => {
    document.body.innerHTML = `
      <li class="top">
        <div class="display-flex">
          <div class="ivm">logo</div>
          <div class="flex-column flex-grow-1">
            <span>Role · Present · Company</span>
          </div>
        </div>
      </li>`;
    const li = document.querySelector('li.top')!;
    const mount = findExperiencePanelMount(li);
    expect(mount.className).toContain('flex-column');
    expect(mount.className).toContain('flex-grow-1');
  });

  it('falls back to the experience li when no inner column', () => {
    document.body.innerHTML = `<li class="plain">Past · 2020 – 2021</li>`;
    const li = document.querySelector('li.plain')!;
    expect(findExperiencePanelMount(li)).toBe(li);
  });
});

describe('tryInjectSalaryPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    stubLocation('/in/user/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    removeSalaryPanel();
  });

  it('returns not_profile_path off profile', () => {
    stubLocation('/jobs/');
    const r = tryInjectSalaryPanel('USD');
    expect(r.success).toBe(false);
    expect(r.reason).toBe('not_profile_path');
    expect(r.panelEl).toBeNull();
  });

  it('injects beside Present role when Experience section is standard', () => {
    document.body.innerHTML = `
      <main>
        <section>
          <div id="experience"></div>
          <ul>
            <li>Software Engineer · Jan 2020 – Present · Company Inc</li>
          </ul>
        </section>
      </main>`;

    const r = tryInjectSalaryPanel('CAD');
    expect(r.success).toBe(true);
    expect(r.reason).toBe('injected');
    expect(r.details.matchStrategy).toBe('present-row');
    expect(r.panelEl).toBeTruthy();

    const panel = document.querySelector(`[${LSE_PANEL_ATTR}]`);
    expect(panel).toBeTruthy();
    expect(panel?.querySelector('.lse-panel__ccy')?.textContent).toContain('CAD');
  });

  it('falls back to first experience row when no Present label', () => {
    document.body.innerHTML = `
      <main>
        <section>
          <div id="experience"></div>
          <ul>
            <li>Past role · Jan 2018 – Dec 2019</li>
          </ul>
        </section>
      </main>`;

    const r = tryInjectSalaryPanel('USD');
    expect(r.success).toBe(true);
    expect(r.details.matchStrategy).toBe('first-row-fallback');
  });

  it('finds Present via loose main scope when #experience anchor is absent', () => {
    document.body.innerHTML = `
      <main>
        <ul>
          <li>Consultant · 2021 – Present · Firm</li>
        </ul>
      </main>`;

    const r = tryInjectSalaryPanel('EUR');
    expect(r.success).toBe(true);
    expect(r.details.matchStrategy).toBe('present-row');
  });
});
