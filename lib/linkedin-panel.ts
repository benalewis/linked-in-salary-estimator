/** In-page salary estimate panel for LinkedIn profile Experience (DOM varies; selectors are best-effort). */

import { formatMoney, normalizeCurrencyCode } from '@/lib/currencies';
import type { SalaryEstimateInput, SalaryEstimateParsed } from '@/lib/salary-estimate-types';

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
  /** Set when the panel was inserted successfully (use for follow-up LLM updates). */
  panelEl: HTMLElement | null;
};

export function removeSalaryPanel(): void {
  document.querySelectorAll(`[${LSE_PANEL_ATTR}]`).forEach((el) => el.remove());
}

function nodeIsInsideSalaryPanel(node: Node): boolean {
  if (node.nodeType === Node.DOCUMENT_NODE) {
    return false;
  }
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) {
    return false;
  }
  return el.closest(`[${LSE_PANEL_ATTR}]`) != null;
}

/**
 * True when every mutation target sits inside our injected panel (`data-lse-salary-panel`).
 * Busy UI (timer text / phases) mutates only this subtree — ignoring these avoids a reinject loop.
 */
export function mutationsAreOnlyInsideSalaryPanel(mutations: ReadonlyArray<MutationRecord>): boolean {
  if (mutations.length === 0) {
    return false;
  }
  for (const m of mutations) {
    if (!nodeIsInsideSalaryPanel(m.target)) {
      return false;
    }
  }
  return true;
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
    return { success: false, reason: 'not_profile_path', details, panelEl: null };
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
    return { success: false, reason: 'no_experience_section', details, panelEl: null };
  }

  if (items.length === 0) {
    const globalLi = findPresentLiGlobalScan(details);
    if (globalLi) {
      return injectPanel(globalLi, details, 'global-present-scan', displayCurrencyCode);
    }
    return { success: false, reason: 'no_list_items', details, panelEl: null };
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

/**
 * LinkedIn Experience rows are usually a horizontal flex: logo | text stack.
 * Appending to the outer `li` makes our panel a flex sibling and it often lands in the wrong column
 * (overlapping the description). Prefer the inner text column when present.
 */
export function findExperiencePanelMount(li: HTMLElement): HTMLElement {
  const col =
    li.querySelector<HTMLElement>('div.flex-column.flex-grow-1') ??
    li.querySelector<HTMLElement>('[class*="flex-column"][class*="flex-grow-1"]') ??
    li.querySelector<HTMLElement>('.flex-column.full-width');
  return col ?? li;
}

function injectPanel(
  li: HTMLElement,
  details: Record<string, unknown>,
  mode: 'present-row' | 'global-present-scan' | 'first-row-fallback',
  displayCurrencyCode: string,
): InjectionResult {
  const panel = createPanelElement(mode, displayCurrencyCode);
  const mount = findExperiencePanelMount(li);
  mount.appendChild(panel);
  details.panelMount = mount === li ? 'li' : 'inner-column';
  details.matchStrategy = mode;
  details.matchedTextLen = (li.innerText ?? '').length;
  return { success: true, reason: 'injected', details, panelEl: panel };
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
      ? 'No “Present” date found — estimate may not match the top Experience row.'
      : mode === 'global-present-scan'
        ? 'Attached via page scan (Experience layout non-standard).'
        : 'Fetching a public-market estimate…';

  host.innerHTML = `
    <div class="lse-panel__header">Est. compensation <span class="lse-panel__ccy">(${ccy})</span></div>
    <div class="lse-panel__busy" data-lse-field="busy" hidden>
      <div class="lse-panel__busy-inner">
        <div class="lse-panel__spinner" aria-hidden="true"></div>
        <div class="lse-panel__busy-text">
          <div class="lse-panel__busy-headline" data-lse-field="busy-headline">Estimating compensation</div>
          <div class="lse-panel__busy-detail" data-lse-field="busy-detail"></div>
          <div class="lse-panel__busy-meta" data-lse-field="busy-meta"></div>
        </div>
      </div>
      <div class="lse-panel__busy-track" aria-hidden="true"><div class="lse-panel__busy-fill"></div></div>
    </div>
    <div class="lse-panel__row"><span class="lse-panel__label">Range</span><span class="lse-panel__value" data-lse-field="range">—</span></div>
    <div class="lse-panel__row"><span class="lse-panel__label">TC (incl. bonus)</span><span class="lse-panel__value" data-lse-field="tc">—</span></div>
    <p class="lse-panel__note" data-lse-field="note">${note}</p>
  `;

  return host;
}

const BUSY_PHASES = [
  {
    headline: 'Reading your profile…',
    detail: 'Picking up role, employer, and location from this Experience row and your headline.',
  },
  {
    headline: 'Checking public benchmarks…',
    detail: 'Reasoning against typical ranges people publish (Glassdoor, Levels.fyi, Payscale, filings, etc.).',
  },
  {
    headline: 'Formatting your estimate…',
    detail: 'Turning the model output into numbers in your chosen display currency.',
  },
] as const;

const PHASE_INTERVAL_MS = 5200;
const ELAPSED_INTERVAL_MS = 1000;

function formatBusyMeta(elapsedSec: number): string {
  const baseline = 'Most requests finish in about 15–90 seconds (model + network).';
  if (elapsedSec <= 0) {
    return baseline;
  }
  if (elapsedSec < 90) {
    return `${elapsedSec}s elapsed · ${baseline}`;
  }
  if (elapsedSec < 150) {
    return `${elapsedSec}s elapsed · Still running — Gemini with web search can take longer.`;
  }
  return `${elapsedSec}s elapsed · If nothing appears, open the extension popup and confirm your API key.`;
}

/**
 * Shows a clear “request in flight” state: spinner, rotating phases, elapsed time + expectations.
 * Call the returned function before painting success/error so the note row can update.
 */
export function beginSalaryPanelBusy(panel: HTMLElement): () => void {
  let done = false;
  let elapsedSec = 0;
  let phaseIndex = 0;

  panel.setAttribute('aria-busy', 'true');
  panel.classList.add('lse-panel--busy', 'lse-panel--loading');
  panel.querySelector('[data-lse-field="range"]')!.textContent = '…';
  panel.querySelector('[data-lse-field="tc"]')!.textContent = '…';

  const busy = panel.querySelector('[data-lse-field="busy"]');
  const headlineEl = panel.querySelector('[data-lse-field="busy-headline"]');
  const detailEl = panel.querySelector('[data-lse-field="busy-detail"]');
  const metaEl = panel.querySelector('[data-lse-field="busy-meta"]');

  function applyPhase(i: number): void {
    const ph = BUSY_PHASES[i % BUSY_PHASES.length]!;
    if (headlineEl) {
      headlineEl.textContent = ph.headline;
    }
    if (detailEl) {
      detailEl.textContent = ph.detail;
    }
  }

  if (busy instanceof HTMLElement) {
    busy.hidden = false;
  }
  applyPhase(0);
  if (metaEl) {
    metaEl.textContent = formatBusyMeta(0);
  }

  const tickPhase = (): void => {
    phaseIndex = (phaseIndex + 1) % BUSY_PHASES.length;
    applyPhase(phaseIndex);
  };

  const tickElapsed = (): void => {
    elapsedSec += 1;
    if (metaEl) {
      metaEl.textContent = formatBusyMeta(elapsedSec);
    }
  };

  const phaseId = window.setInterval(tickPhase, PHASE_INTERVAL_MS);
  const elapsedId = window.setInterval(tickElapsed, ELAPSED_INTERVAL_MS);

  return (): void => {
    if (done) {
      return;
    }
    done = true;
    window.clearInterval(phaseId);
    window.clearInterval(elapsedId);
    panel.removeAttribute('aria-busy');
    panel.classList.remove('lse-panel--busy', 'lse-panel--loading');
    if (busy instanceof HTMLElement) {
      busy.hidden = true;
    }
  };
}

/** Build LLM input from the Experience row `li` and the visible profile header (best-effort selectors). */
export function collectSalaryEstimateContext(
  experienceLi: HTMLElement,
  displayCurrencyCode: string,
): SalaryEstimateInput {
  const profileName =
    document.querySelector('main h1')?.textContent?.trim() ??
    document.querySelector('h1')?.textContent?.trim() ??
    null;

  const headline =
    document.querySelector('main .text-body-medium.break-words')?.textContent?.trim() ??
    document.querySelector('.pv-top-card .text-body-medium')?.textContent?.trim() ??
    document.querySelector('main .pv-text-details__left-panel .text-body-medium')?.textContent?.trim() ??
    null;

  return {
    profileName,
    headline,
    experienceRowText: (experienceLi.innerText ?? '').replace(/\s+/g, ' ').trim(),
    profileUrl: location.href,
    outputCurrency: normalizeCurrencyCode(displayCurrencyCode),
  };
}

export function applySalaryEstimateToPanel(
  panel: HTMLElement,
  estimate: SalaryEstimateParsed,
  displayCurrencyCode: string,
): void {
  const ccy = normalizeCurrencyCode(displayCurrencyCode);
  const rangeStr = `${formatMoney(estimate.salaryLow, ccy)} – ${formatMoney(estimate.salaryHigh, ccy)}`;
  panel.querySelector('[data-lse-field="range"]')!.textContent = rangeStr;
  panel.querySelector('[data-lse-field="tc"]')!.textContent = formatMoney(estimate.totalComp, ccy);
  const note = panel.querySelector('[data-lse-field="note"]');
  if (note) {
    const src = estimate.sourcesUsed.length
      ? estimate.sourcesUsed.slice(0, 5).join(' · ')
      : 'Public compensation benchmarks';
    const conf =
      estimate.confidence === 'low' || estimate.confidence === 'medium' || estimate.confidence === 'high'
        ? `Confidence: ${estimate.confidence}. `
        : '';
    note.textContent = `${conf}${estimate.disclaimer} Sources: ${src}.`;
  }
}

export function applySalaryPanelError(panel: HTMLElement, message: string): void {
  panel.querySelector('[data-lse-field="range"]')!.textContent = '—';
  panel.querySelector('[data-lse-field="tc"]')!.textContent = '—';
  const note = panel.querySelector('[data-lse-field="note"]');
  if (note) {
    note.textContent = `Could not estimate: ${message}`;
  }
}
