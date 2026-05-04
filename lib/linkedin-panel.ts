/** In-page salary estimate panel for LinkedIn profile Experience (DOM varies; selectors are best-effort). */

import { formatMoney, normalizeCurrencyCode } from '@/lib/currencies';
import { queryLinkedInProfileMain } from '@/lib/linkedin-main-root';
import { scrapeLinkedInProfileSections } from '@/lib/linkedin-profile-scrape';
import type { EstimateRunMode } from '@/lib/lse-settings';
import type { SalaryEstimateInput, SalaryEstimateParsed } from '@/lib/salary-estimate-types';

export const LSE_PANEL_ATTR = 'data-lse-salary-panel';

const explainPopoverDocListeners = new WeakMap<HTMLElement, AbortController>();

/** Modern LinkedIn Experience feed uses stacked entity cards keyed by LinkedIn internals (often `div`s, not `ul > li`). */
const EXPERIENCE_ENTITY_CARD_SEL = '[componentkey^="entity-collection-item"]';

export type InjectionResult = {
  success: boolean;
  reason:
    | 'injected'
    | 'not_profile_path'
    | 'no_experience_section'
    | 'no_list_items';
  details: Record<string, unknown>;
  /** Set when the panel was inserted successfully (use for follow-up LLM updates). */
  panelEl: HTMLElement | null;
};

export function removeSalaryPanel(): void {
  document.querySelectorAll(`[${LSE_PANEL_ATTR}]`).forEach((el) => {
    if (el instanceof HTMLElement) {
      explainPopoverDocListeners.get(el)?.abort();
      explainPopoverDocListeners.delete(el);
    }
    el.remove();
  });
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

/**
 * True when `element` sits inside LinkedIn's profile **Experience** block (heading or #experience anchor),
 * so we never mount the salary panel beside Education, Featured, etc.
 */
export function profileExperienceSectionContains(element: HTMLElement): boolean {
  for (const sel of ['#experience', '[id="experience"]', '[data-section="experience"]'] as const) {
    const anchor = document.querySelector(sel);
    const sec = anchor?.closest('section');
    if (sec instanceof HTMLElement && sec.contains(element)) {
      return true;
    }
  }
  const byHeading = [...document.querySelectorAll('section')].find((sec) => {
    const t = sec.querySelector('h2, h3')?.textContent?.trim() ?? '';
    return /^\s*experience\s*$/i.test(t);
  });
  return byHeading instanceof HTMLElement && byHeading.contains(element);
}

export function tryInjectSalaryPanel(
  displayCurrencyCode: string,
  estimateRunMode: EstimateRunMode = 'manual',
): InjectionResult {
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
    const looseLi = findLooseMostRecentRole(details);
    if (looseLi) {
      return injectPanel(looseLi, details, 'global-recent-scan', displayCurrencyCode, estimateRunMode);
    }
    return { success: false, reason: 'no_experience_section', details, panelEl: null };
  }

  if (items.length === 0) {
    const looseLi = findLooseMostRecentRole(details);
    if (looseLi) {
      return injectPanel(looseLi, details, 'global-recent-scan', displayCurrencyCode, estimateRunMode);
    }
    return { success: false, reason: 'no_list_items', details, panelEl: null };
  }

  const companyRow = items[0]!;
  const targetLi = resolveMostRecentPositionLi(companyRow);
  details.mostRecentEmployerDomIndex = 0;
  details.roleMount =
    targetLi === companyRow ? 'single-role-or-unparsed-card' : 'first-nested-role-under-employer';
  return injectPanel(targetLi, details, 'most-recent-role', displayCurrencyCode, estimateRunMode);
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
  mode: 'most-recent-role' | 'global-recent-scan',
  displayCurrencyCode: string,
  estimateRunMode: EstimateRunMode,
): InjectionResult {
  if (!profileExperienceSectionContains(li)) {
    details.rejectionReason = 'mount_outside_experience_module';
    return { success: false, reason: 'no_experience_section', details, panelEl: null };
  }
  const panel = createPanelElement(mode, displayCurrencyCode, estimateRunMode);
  const mount = findExperiencePanelMount(li);
  mount.appendChild(panel);
  details.panelMount = mount === li ? 'li' : 'inner-column';
  details.matchStrategy = mode;
  details.matchedTextLen = (li.innerText ?? '').length;
  return { success: true, reason: 'injected', details, panelEl: panel };
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
  const main = queryLinkedInProfileMain(document);

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

  /** Never scoped to bare `main` — avoids attaching to unrelated lists (Featured, suggestions, …). */
  details.experienceScopeVia = 'loose:no-heading-section';
  return null;
}

/** Distance from `scope` — shallow lists are the main Experience feed; nested role lists under one company are deeper. */
function depthFromScope(el: Element, scope: Element): number {
  let d = 0;
  let x: Element | null = el;
  while (x && x !== scope) {
    d++;
    x = x.parentElement;
  }
  return d;
}

/** `entity-collection-item` cards scoped to Experience; skips nodes nested inside another such card on the rare layouts that duplicate the key. */
function listExperienceEntityCards(scope: Element): HTMLElement[] {
  const hits = [...scope.querySelectorAll(EXPERIENCE_ENTITY_CARD_SEL)] as HTMLElement[];
  return hits.filter((el) => {
    const parent = el.parentElement;
    const outer = parent?.closest(EXPERIENCE_ENTITY_CARD_SEL);
    return outer == null;
  });
}

/**
 * Prefer dedicated Experience anchors (avoid `main`-wide scans where unrelated entity widgets also use `entity-collection-item`).
 */
function entityCollectionCardsEnabled(details: Record<string, unknown>): boolean {
  const v = details.experienceScopeVia;
  return v === '#experience' || v === 'heading:Experience' || v === 'loose:section+h2';
}

function listExperienceItems(scope: Element, details: Record<string, unknown>): HTMLElement[] {
  if (entityCollectionCardsEnabled(details)) {
    const cards = listExperienceEntityCards(scope);
    if (cards.length > 0) {
      details.listStrategy = `entity-collection-item (${cards.length} cards)`;
      return cards;
    }
  }

  type Cand = { top: HTMLElement[]; depth: number };
  /** First `ul` in document order among those at minimal depth (`querySelectorAll` order). Older code maximized `li` count among ties, which picked nested multi-role lists in some React layouts. */
  let best: Cand | null = null;
  for (const ul of scope.querySelectorAll('ul')) {
    const top = [...ul.children].filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.tagName === 'LI',
    );
    if (top.length === 0) {
      continue;
    }
    const depth = depthFromScope(ul, scope);
    if (best === null || depth < best.depth) {
      best = { top, depth };
    }
  }

  if (best !== null) {
    details.listStrategy = `shallowest-ul-first (depth ${best.depth}, ${best.top.length} li)`;
    return best.top;
  }

  const fallback = [...scope.querySelectorAll('li.artdeco-list__item, li[class*="pvs-list"]')].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );
  details.listStrategy = fallback.length ? 'fallback-li-query' : 'none';
  return fallback;
}

/**
 * First top-level company card = most recent employer (LinkedIn reverse-chronological order).
 * If that card groups multiple roles in a nested list, the first nested row is the most recent role there.
 */
export function resolveMostRecentPositionLi(companyRowLi: HTMLElement): HTMLElement {
  for (const ul of companyRowLi.querySelectorAll(':scope ul')) {
    const lis = [...ul.children].filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.tagName === 'LI',
    );
    if (lis.length >= 2) {
      return lis[0]!;
    }
  }
  return companyRowLi;
}

/**
 * Walk from the injected panel anchor to the Experience row/card DOM node.
 * React layouts anchor on `entity-collection-item` `div`s; classic markup uses `li`.
 */
export function resolveExperienceHostFromSalaryPanel(panelEl: HTMLElement): HTMLElement | null {
  const entity = panelEl.closest(EXPERIENCE_ENTITY_CARD_SEL);
  if (entity instanceof HTMLElement) {
    return entity;
  }
  const li = panelEl.closest('li');
  return li instanceof HTMLElement ? li : null;
}

/** Same list heuristic, scoped to the Experience subsection inside `main` so we do not pick another shallow list (e.g. recommendations). */
function findLooseMostRecentRole(details: Record<string, unknown>): HTMLElement | null {
  const main = queryLinkedInProfileMain(document);
  if (!main) {
    return null;
  }
  const expSec = [...main.querySelectorAll('section')].find((sec) => {
    const hx = sec.querySelector('h2, h3');
    return /\bexperience\b/i.test(hx?.textContent ?? '');
  });
  if (!expSec) {
    return null;
  }
  const scope = expSec;

  const subDetails: Record<string, unknown> = {};
  subDetails.experienceScopeVia = 'loose:section+h2';
  const items = listExperienceItems(scope, subDetails);
  details.looseListStrategy = subDetails.listStrategy;
  details.looseScopeVia = 'main>section:Experience';
  if (items.length === 0) {
    return null;
  }
  return resolveMostRecentPositionLi(items[0]!);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wireSalaryPanelExplainPopover(panel: HTMLElement, explainToggleIdAttr: string, explainBodyIdAttr: string): void {
  const toggle = panel.querySelector(`#${CSS.escape(explainToggleIdAttr)}`);
  const body = panel.querySelector(`#${CSS.escape(explainBodyIdAttr)}`);
  if (!(toggle instanceof HTMLButtonElement) || !(body instanceof HTMLElement)) {
    return;
  }

  const setOpen = (open: boolean): void => {
    body.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('lse-panel--explain-open', open);
  };

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!!body.hidden);
  });

  explainPopoverDocListeners.get(panel)?.abort();
  const ac = new AbortController();
  explainPopoverDocListeners.set(panel, ac);
  const docOpts = { capture: true, signal: ac.signal } as const;

  document.addEventListener(
    'click',
    (e) => {
      if (!panel.isConnected || !panel.classList.contains('lse-panel--explain-open')) {
        return;
      }
      if (e.target instanceof Node && panel.contains(e.target)) {
        return;
      }
      setOpen(false);
    },
    docOpts,
  );

  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (
        !panel.isConnected ||
        !panel.classList.contains('lse-panel--explain-open') ||
        e.key !== 'Escape'
      ) {
        return;
      }
      setOpen(false);
      toggle.focus();
    },
    docOpts,
  );
}

function createPanelElement(
  mode: 'most-recent-role' | 'global-recent-scan',
  displayCurrencyCode: string,
  estimateRunMode: EstimateRunMode,
): HTMLElement {
  const host = document.createElement('aside');
  host.setAttribute(LSE_PANEL_ATTR, '');
  host.className = 'lse-panel';
  host.setAttribute('aria-label', 'Estimated compensation (extension)');
  host.dataset.lseEstimateTrigger = estimateRunMode;
  const explainUid = `${Math.random().toString(36).slice(2, 11)}`;
  const explainToggleIdAttr = `lse-explain-t-${explainUid}`;
  const explainBodyIdAttr = `lse-explain-b-${explainUid}`;
  const ccy = escapeHtml(displayCurrencyCode);

  const manualHint =
    estimateRunMode === 'manual'
      ? 'Click Run when you want an estimate.'
      : 'An estimate starts automatically when this panel appears. Click Run to refresh.';

  const note =
    mode === 'global-recent-scan'
      ? 'Attached via main-column scan (Experience layout non-standard).'
      : estimateRunMode === 'manual'
        ? 'Manual mode: estimates run only after you choose Run.'
        : 'Fetching a public-market estimate…';

  host.innerHTML = `
    <div class="lse-panel__header">Est. compensation <span class="lse-panel__ccy">(${ccy})</span></div>
    <div class="lse-panel__manual" data-lse-field="manual-cta">
      <p class="lse-panel__manual-text">${escapeHtml(manualHint)}</p>
      <button type="button" class="lse-panel__run" data-lse-run-estimate>Run</button>
    </div>
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
    <div class="lse-panel__row"><span class="lse-panel__label">TC (base+bonus+stock)</span><span class="lse-panel__value" data-lse-field="tc">—</span></div>
    <div class="lse-panel__explain">
      <button type="button" class="lse-panel__explain-toggle" id="${explainToggleIdAttr}"
        aria-expanded="false" aria-controls="${explainBodyIdAttr}">Why this estimate?</button>
      <div class="lse-panel__explain-body" id="${explainBodyIdAttr}" hidden role="region"
        aria-labelledby="${explainToggleIdAttr}">
        <p class="lse-panel__note" data-lse-field="note">${escapeHtml(note)}</p>
      </div>
    </div>
  `;

  wireSalaryPanelExplainPopover(host, explainToggleIdAttr, explainBodyIdAttr);
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

  const manualCta = panel.querySelector('[data-lse-field="manual-cta"]') as HTMLElement | null;
  let manualPriorHidden = true;
  if (manualCta && panel.dataset.lseEstimateTrigger === 'manual') {
    manualPriorHidden = Boolean(manualCta.hidden);
    if (!manualPriorHidden) {
      manualCta.hidden = true;
    }
  }

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
    if (manualCta && panel.dataset.lseEstimateTrigger === 'manual') {
      manualCta.hidden = manualPriorHidden;
    }
  };
}

/** Build LLM input from the Experience row `li`, top-card fields, and scraped profile sections. */
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

  const sections = scrapeLinkedInProfileSections();

  return {
    profileName,
    headline,
    experienceRowText: (experienceLi.innerText ?? '').replace(/\s+/g, ' ').trim(),
    profileUrl: location.href,
    outputCurrency: normalizeCurrencyCode(displayCurrencyCode),
    experienceSectionText: sections.experienceSectionText,
    educationSectionText: sections.educationSectionText,
    skillsSectionText: sections.skillsSectionText,
    aboutText: sections.aboutText,
    certificationsSectionText: sections.certificationsText,
    locationLine: sections.locationLine,
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
