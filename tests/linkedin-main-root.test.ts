import { describe, expect, it } from 'vitest';
import { queryLinkedInProfileMain } from '@/lib/linkedin-main-root';

describe('queryLinkedInProfileMain', () => {
  it('prefers scaffold main when present', () => {
    document.body.innerHTML = `
      <main>
        <div class="noise"></div>
        <div class="scaffold-layout__main"><div id="inner">x</div></div>
      </main>`;
    expect(queryLinkedInProfileMain(document)?.querySelector('#inner')).not.toBeNull();
  });

  it('falls back to main [role="main"]', () => {
    document.body.innerHTML = `<main><div role="main" id="r">y</div></main>`;
    expect(queryLinkedInProfileMain(document)?.id).toBe('r');
  });

  it('falls back to main element', () => {
    document.body.innerHTML = `<main id="m"></main>`;
    expect(queryLinkedInProfileMain(document)?.id).toBe('m');
  });
});
