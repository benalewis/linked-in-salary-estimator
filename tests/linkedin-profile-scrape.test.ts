import { beforeEach, describe, expect, it } from 'vitest';
import { scrapeLinkedInProfileSections } from '@/lib/linkedin-profile-scrape';

describe('scrapeLinkedInProfileSections', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts Experience, Education, and Skills from main column sections', () => {
    document.body.innerHTML = `
      <main>
        <div class="scaffold-layout__main">
          <section>
            <h2>Experience</h2>
            <ul><li>Engineer · Acme · Present</li></ul>
          </section>
          <section>
            <h2>Education</h2>
            <div>Example University</div>
          </section>
          <section>
            <h2>Skills</h2>
            <div>TypeScript</div>
          </section>
        </div>
      </main>`;

    const r = scrapeLinkedInProfileSections();
    expect(r.experienceSectionText).toMatch(/Engineer/);
    expect(r.educationSectionText).toMatch(/Example University/);
    expect(r.skillsSectionText).toMatch(/TypeScript/);
  });

  it('returns nulls when main is missing', () => {
    document.body.innerHTML = '<div></div>';
    const r = scrapeLinkedInProfileSections();
    expect(r.experienceSectionText).toBeNull();
  });
});
