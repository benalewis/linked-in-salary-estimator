/** Best-effort scraping of public LinkedIn profile sections (DOM varies by locale/layout). */

import { queryLinkedInProfileMain } from '@/lib/linkedin-main-root';

const MAX_SECTION_CHARS = 12_000;

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number): string {
  const t = normalizeWs(s);
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function profileMainRoot(): Element | null {
  return queryLinkedInProfileMain(document);
}

function sectionByHeading(allSections: Element[], pattern: RegExp): Element | null {
  for (const sec of allSections) {
    const hx = sec.querySelector(':scope > div h2, :scope > h2, :scope h2, :scope h3');
    const t = hx?.textContent ?? '';
    const oneLine = normalizeWs(t);
    if (pattern.test(oneLine)) {
      return sec;
    }
  }
  return null;
}

export type LinkedInProfileSections = {
  experienceSectionText: string | null;
  educationSectionText: string | null;
  skillsSectionText: string | null;
  aboutText: string | null;
  certificationsText: string | null;
  locationLine: string | null;
};

/**
 * Pull visible text from major profile sections so the model sees real page content
 * (positions, education, skills, etc.), not only the single Experience row we attach the UI to.
 */
export function scrapeLinkedInProfileSections(): LinkedInProfileSections {
  const empty: LinkedInProfileSections = {
    experienceSectionText: null,
    educationSectionText: null,
    skillsSectionText: null,
    aboutText: null,
    certificationsText: null,
    locationLine: null,
  };

  const main = profileMainRoot();
  if (!main) {
    return empty;
  }

  const sections = [...main.querySelectorAll('section')];

  const experienceEl =
    document.querySelector('#experience')?.closest('section') ??
    sectionByHeading(sections, /^\s*experience\s*$/i) ??
    sectionByHeading(sections, /\bexperience\b/i);

  const educationEl =
    document.querySelector('#education')?.closest('section') ??
    sectionByHeading(sections, /^\s*education\s*$/i) ??
    sectionByHeading(sections, /\beducation\b/i);

  const skillsEl =
    document.querySelector('#skills')?.closest('section') ??
    sectionByHeading(sections, /^\s*skills\s*$/i) ??
    sectionByHeading(sections, /\bskills\b/i);

  const aboutEl =
    document.querySelector('#about')?.closest('section') ??
    sectionByHeading(sections, /^\s*about\s*$/i) ??
    sectionByHeading(sections, /\babout\b/i);

  const certEl = sectionByHeading(sections, /\b(certifications|licenses\s+&\s+certifications)\b/i);

  const experienceSectionText = experienceEl ? truncate(experienceEl.innerText ?? '', MAX_SECTION_CHARS) : null;
  const educationSectionText = educationEl ? truncate(educationEl.innerText ?? '', MAX_SECTION_CHARS) : null;
  const skillsSectionText = skillsEl ? truncate(skillsEl.innerText ?? '', MAX_SECTION_CHARS) : null;
  const aboutText = aboutEl ? truncate(aboutEl.innerText ?? '', MAX_SECTION_CHARS) : null;
  const certificationsText = certEl ? truncate(certEl.innerText ?? '', MAX_SECTION_CHARS) : null;

  const locationLine =
    document.querySelector('main h1')?.parentElement?.querySelector('.text-body-small')?.textContent?.trim() ??
    main.querySelector('.pv-text-details__left-panel .text-body-small')?.textContent?.trim() ??
    document.querySelector('[data-section="topCard"] .text-body-small')?.textContent?.trim() ??
    null;

  return {
    experienceSectionText: experienceSectionText || null,
    educationSectionText: educationSectionText || null,
    skillsSectionText: skillsSectionText || null,
    aboutText: aboutText || null,
    certificationsText: certificationsText || null,
    locationLine: locationLine ? normalizeWs(locationLine) : null,
  };
}
