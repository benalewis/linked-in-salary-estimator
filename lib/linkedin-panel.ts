/** In-page salary estimate panel for LinkedIn profile Experience (DOM varies; selectors are best-effort). */

export const LSE_PANEL_ATTR = 'data-lse-salary-panel';

export type InjectionResult = {
  success: boolean;
  reason:
    | 'injected'
    | 'not_profile_path'
    | 'no_experience_section'
    | 'no_list_items'
    | 'no_present_role'
    | 'present_too_short';
  details: Record<string, unknown>;
};

export function removeSalaryPanel(): void {
  document.querySelectorAll(`[${LSE_PANEL_ATTR}]`).forEach((el) => el.remove());
}

export function isProfilePath(): boolean {
  return /^\/in\/[^/]+/i.test(location.pathname);
}

export function tryInjectSalaryPanel(displayCurrencyCode: string): InjectionResult {
  const details: Record<string, unknown> = {
    path: location.pathname,
    href: location.href,
  };

  if (!isProfilePath()) {
    removeSalaryPanel();
    return { success: false, reason: 'not_profile_path', details };
  }

  removeSalaryPanel();

  let scope = findExperienceScope(details);
  let items = scope ? listExperienceItems(scope, details) : [];

  if (!scope || items.length === 0) {
    scope = findExperienceScopeLoose(details);
    if (scope) {
      items = listExperienceItems(scope, details);
    }
  }

  details.itemCount = items.length;
  details.firstItemsTextPreview = items.slice(0, 4).map((li) => compactPreview(li.innerText ?? '', 140));

  if (!scope) {
    const globalLi = findPresentLiGlobalScan(details);
    if (globalLi) {
      return injectPanel(globalLi, details, 'global-present-scan', displayCurrencyCode);
    }
    return { success: false, reason: 'no_experience_section', details };
  }

  if (items.length === 0) {
    const globalLi = findPresentLiGlobalScan(details);
    if (globalLi) {
      return injectPanel(globalLi, details, 'global-present-scan', displayCurrencyCode);
    }
    return { success: false, reason: 'no_list_items', details };
  }

  const presentMatch = findPresentInItems(items, details);
  if (presentMatch) {
    return injectPanel(presentMatch.li, details, presentMatch.mode, displayCurrencyCode);
  }

  const globalLi = findPresentLiGlobalScan(details);
  if (globalLi) {
    return injectPanel(globalLi, details, 'global-present-scan', displayCurrencyCode);
  }

  // Last resort: first Experience row so the extension is visibly working; copy explains uncertainty.
  details.hint =
    'No "Present" / "Présent" in Experience rows — attached placeholder to the first Experience entry.';
  return injectPanel(items[0]!, details, 'first-row-fallback', displayCurrencyCode);
}

function injectPanel(
  li: HTMLElement,
  details: Record<string, unknown>,
  mode: 'present-row' | 'global-present-scan' | 'first-row-fallback',
  displayCurrencyCode: string,
): InjectionResult {
  const panel = createPanelElement(mode, displayCurrencyCode);
  li.appendChild(panel);
  details.matchStrategy = mode;
  details.matchedTextLen = (li.innerText ?? '').length;
  return { success: true, reason: 'injected', details };
}

function findPresentInItems(
  items: HTMLElement[],
  details: Record<string, unknown>,
): { li: HTMLElement; mode: 'present-row' } | null {
  let presentButShort = 0;
  for (let i = 0; i < items.length; i++) {
    const li = items[i]!;
    const text = li.innerText ?? '';
    if (!looksLikeCurrentRole(text)) {
      continue;
    }
    if (text.length < 8) {
      presentButShort++;
      details.presentTooShortSampleLen ??= text.length;
      continue;
    }
    details.matchedIndex = i;
    return { li, mode: 'present-row' };
  }
  details.presentRowsTooShort = presentButShort;
  return null;
}

function compactPreview(s: string, max: number): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : `${one.slice(0, max)}…`;
}

function findExperienceScope(details: Record<string, unknown>): Element | null {
  const anchor =
    document.querySelector('#experience') ??
    document.querySelector('[id="experience"]') ??
    document.querySelector('[data-section="experience"]');

  details.hasHashExperience = Boolean(anchor);
  if (anchor) {
    const section =
      anchor.closest('section') ??
      anchor.closest('[class*="profile"]') ??
      anchor.closest('div[class*="scaffold"]') ??
      anchor.parentElement;
    details.experienceScopeVia = '#experience';
    details.experienceScopeTag = section?.nodeName ?? null;
    return section;
  }

  const byHeading = [...document.querySelectorAll('section')].find((sec) => {
    const t = sec.querySelector('h2, h3')?.textContent?.trim() ?? '';
    return /^\s*experience\s*$/i.test(t);
  });
  if (byHeading) {
    details.experienceScopeVia = 'heading:Experience';
    return byHeading;
  }

  details.experienceScopeVia = null;
  return null;
}

/** When strict Experience block is missing (new layouts), search within main column. */
function findExperienceScopeLoose(details: Record<string, unknown>): Element | null {
  const main =
    document.querySelector('main .scaffold-layout__main') ??
    document.querySelector('main [role="main"]') ??
    document.querySelector('main');

  if (!main) {
    return null;
  }

  for (const sec of main.querySelectorAll('section')) {
    const hx = sec.querySelector('h2, h3');
    if (hx && /\bexperience\b/i.test(hx.textContent ?? '')) {
      details.experienceScopeVia = 'loose:section+h2';
      return sec;
    }
  }

  details.experienceScopeVia = 'loose:main';
  return main;
}

function listExperienceItems(scope: Element, details: Record<string, unknown>): HTMLElement[] {
  const uls = [...scope.querySelectorAll('ul')];
  let best: HTMLElement[] = [];
  let bestScore = 0;
  for (const ul of uls) {
    const top = [...ul.children].filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.tagName === 'LI',
    );
    if (top.length > bestScore) {
      bestScore = top.length;
      best = top;
    }
  }
  if (best.length > 0) {
    details.listStrategy = `max-ul (${bestScore} top-level li)`;
    return best;
  }

  const fallback = [...scope.querySelectorAll('li.artdeco-list__item, li[class*="pvs-list"]')].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );
  details.listStrategy = fallback.length ? 'fallback-li-query' : 'none';
  return fallback;
}

/** Broad scan: first job-sized `li` under main whose text includes Present (handles odd nesting). */
function findPresentLiGlobalScan(details: Record<string, unknown>): HTMLElement | null {
  const root =
    document.querySelector('main .scaffold-layout__main') ??
    document.querySelector('main') ??
    document.body;

  const lis = root.querySelectorAll('li');
  const candidates: HTMLElement[] = [];
  for (const li of lis) {
    if (!(li instanceof HTMLElement)) {
      continue;
    }
    const t = li.innerText ?? '';
    if (!looksLikeCurrentRole(t) || t.length < 8 || t.length > 8000) {
      continue;
    }
    candidates.push(li);
  }

  details.globalPresentCandidates = candidates.length;
  return candidates[0] ?? null;
}

function looksLikeCurrentRole(text: string): boolean {
  return /\b(present|présent)\b/i.test(text);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createPanelElement(
  mode: 'present-row' | 'global-present-scan' | 'first-row-fallback',
  displayCurrencyCode: string,
): HTMLElement {
  const host = document.createElement('aside');
  host.setAttribute(LSE_PANEL_ATTR, '');
  host.className = 'lse-panel';
  host.setAttribute('aria-label', 'Estimated compensation (extension)');
  const ccy = escapeHtml(displayCurrencyCode);

  const note =
    mode === 'first-row-fallback'
      ? 'No “Present” date found on this profile — placeholder on first Experience row. Wire up data sources next.'
      : mode === 'global-present-scan'
        ? 'Attached via page scan (Experience layout non-standard). Placeholder numbers.'
        : 'Placeholder — public salary sources not wired up yet.';

  host.innerHTML = `
    <div class="lse-panel__header">Est. compensation <span class="lse-panel__ccy">(${ccy})</span></div>
    <div class="lse-panel__row"><span class="lse-panel__label">Range</span><span class="lse-panel__value">—</span></div>
    <div class="lse-panel__row"><span class="lse-panel__label">TC (incl. bonus)</span><span class="lse-panel__value">—</span></div>
    <p class="lse-panel__note">${note}</p>
  `;

  return host;
}
