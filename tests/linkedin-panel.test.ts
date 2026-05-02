import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findExperiencePanelMount,
  isProfilePath,
  LSE_PANEL_ATTR,
  profileExperienceSectionContains,
  removeSalaryPanel,
  resolveExperienceHostFromSalaryPanel,
  resolveMostRecentPositionLi,
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

describe('resolveExperienceHostFromSalaryPanel', () => {
  it('prefers enclosing entity-collection-item over li', () => {
    document.body.innerHTML = `
      <div componentkey="entity-collection-item--acme">
        <div>
          <aside data-lse-salary-panel id="p"></aside>
        </div>
      </div>`;
    const panel = document.getElementById('p')!;
    const host = resolveExperienceHostFromSalaryPanel(panel);
    expect(host?.getAttribute('componentkey')).toBe('entity-collection-item--acme');
  });

  it('falls back to closest li when no entity card wraps the panel', () => {
    document.body.innerHTML = `<li id="row"><aside data-lse-salary-panel id="p"></aside></li>`;
    const panel = document.getElementById('p')!;
    expect(resolveExperienceHostFromSalaryPanel(panel)?.id).toBe('row');
  });
});

describe('resolveMostRecentPositionLi', () => {
  it('returns the first nested role when a card groups multiple positions', () => {
    document.body.innerHTML = `
      <li id="card">
        <span>British Army</span>
        <ul>
          <li id="r1">University OTC Captain · 2023</li>
          <li id="r2">Other · 2022</li>
        </ul>
      </li>`;
    const card = document.querySelector('#card')! as HTMLElement;
    expect(resolveMostRecentPositionLi(card).id).toBe('r1');
  });

  it('returns the company row when there is no multi-role nested list', () => {
    document.body.innerHTML = `<li id="solo">Bank · JPM · Present</li>`;
    const solo = document.querySelector('#solo')! as HTMLElement;
    expect(resolveMostRecentPositionLi(solo)).toBe(solo);
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
    const li = document.querySelector('li.top')! as HTMLElement;
    const mount = findExperiencePanelMount(li);
    expect(mount.className).toContain('flex-column');
    expect(mount.className).toContain('flex-grow-1');
  });

  it('falls back to the experience li when no inner column', () => {
    document.body.innerHTML = `<li class="plain">Past · 2020 – 2021</li>`;
    const li = document.querySelector('li.plain')! as HTMLElement;
    expect(findExperiencePanelMount(li)).toBe(li);
  });
});

describe('profileExperienceSectionContains', () => {
  it('accepts descendants of #experience owner section only for Experience-labelled blocks', () => {
    document.body.innerHTML = `
      <main>
        <section>
          <h2>Licenses</h2>
          <ul><li id="lic">CPA</li></ul>
        </section>
        <section>
          <h2>Experience</h2>
          <div id="experience"></div>
          <ul><li id="job">SWE · Acme · Present</li></ul>
        </section>
      </main>`;
    expect(profileExperienceSectionContains(document.getElementById('job') as HTMLElement)).toBe(true);
    expect(profileExperienceSectionContains(document.getElementById('lic') as HTMLElement)).toBe(false);
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
    expect(r.details.matchStrategy).toBe('most-recent-role');
    expect(r.panelEl).toBeTruthy();

    const panel = document.querySelector(`[${LSE_PANEL_ATTR}]`) as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.querySelector('.lse-panel__ccy')?.textContent).toContain('CAD');
    const manualWrap = panel.querySelector('[data-lse-field="manual-cta"]') as HTMLElement | null;
    expect(manualWrap?.hidden).toBe(false);
    expect(panel.querySelector('[data-lse-run-estimate]')).toBeTruthy();
    expect(panel.dataset.lseEstimateTrigger).toBe('manual');
  });

  it('auto mode hides manual Run row', () => {
    document.body.innerHTML = `
      <main>
        <section>
          <div id="experience"></div>
          <ul>
            <li>Software Engineer · Jan 2020 – Present · Company Inc</li>
          </ul>
        </section>
      </main>`;

    tryInjectSalaryPanel('USD', 'auto');
    const panel = document.querySelector(`[${LSE_PANEL_ATTR}]`) as HTMLElement;
    const manualWrap = panel.querySelector('[data-lse-field="manual-cta"]') as HTMLElement;
    expect(manualWrap.hidden).toBe(true);
    expect(panel.dataset.lseEstimateTrigger).toBe('auto');
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
    expect(r.details.matchStrategy).toBe('most-recent-role');
  });

  it('resolves Experience by heading when #experience anchor is absent', () => {
    document.body.innerHTML = `
      <main class="scaffold-layout__main">
        <section>
          <h2>Experience</h2>
          <ul>
            <li>Consultant · 2021 – Present · Firm</li>
          </ul>
        </section>
      </main>`;

    const r = tryInjectSalaryPanel('EUR');
    expect(r.success).toBe(true);
    expect(r.details.matchStrategy).toBe('most-recent-role');
  });

  it('prefers the main Experience list over a nested company sublist (grouped roles)', () => {
    document.body.innerHTML = `
      <main>
        <section>
          <div id="experience"></div>
          <ul>
            <li>Banking · J.P. Morgan · Feb 2023 – Present · London</li>
            <li>British Army · 9 yrs
              <ul>
                <li>OTC Training Captain · Part-time · Feb 2023 – May 2023</li>
                <li>Other role · 2022 – 2023</li>
              </ul>
            </li>
          </ul>
        </section>
      </main>`;

    const r = tryInjectSalaryPanel('GBP');
    expect(r.success).toBe(true);
    expect(r.details.matchStrategy).toBe('most-recent-role');
    const panel = document.querySelector(`[${LSE_PANEL_ATTR}]`);
    const hostLi = panel?.closest('li');
    expect(hostLi?.textContent).toMatch(/J\.P\. Morgan/);
    expect(hostLi?.textContent).not.toMatch(/OTC Training/);
  });

  it('uses entity-collection-item card order when React omits classic list styling', () => {
    document.body.innerHTML = `
      <main>
        <section>
          <h2>Experience</h2>
          <div id="experience"></div>
          <ul>
            <!-- Shallow bogus list with many lis (mirrors mistaken shallowest-ul + max-li-count pick). -->
            <li>Army nested li 1 · noise</li>
            <li>Army nested li 2 · noise</li>
            <li>Army nested li 3 · noise</li>
          </ul>
          <div componentkey="entity-collection-item--jpm">
            <div>
              Senior Associate · J.P. Morgan · Present · London
              <button type="button">more</button>
            </div>
          </div>
          <div componentkey="entity-collection-item--army">
            <div>British Army · 9 yrs</div>
            <ul>
              <li>University of London OTC Captain · Feb 2023 – May 2023</li>
              <li>Other nested role · 2022 – 2023</li>
            </ul>
          </div>
        </section>
      </main>`;

    const r = tryInjectSalaryPanel('GBP');
    expect(r.success).toBe(true);
    expect(r.details.listStrategy).toMatch(/entity-collection-item/);
    const panelHost = document.querySelector(`[${LSE_PANEL_ATTR}]`)?.parentElement;
    const card = panelHost?.closest('[componentkey^="entity-collection-item"]');
    expect(card?.getAttribute('componentkey')).toBe('entity-collection-item--jpm');
  });
});
