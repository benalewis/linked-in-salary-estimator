/**
 * Profile main column on LinkedIn (best-effort; layout varies).
 * Keeps scaffold selectors aligned across panel positioning and scraping.
 */
export function queryLinkedInProfileMain(doc: Pick<Document, 'querySelector'> = document): Element | null {
  return (
    doc.querySelector('main .scaffold-layout__main') ??
    doc.querySelector('main [role="main"]') ??
    doc.querySelector('main')
  );
}
