/** User-facing text for common extension lifecycle errors (pure; safe in Node/tests). */

export function formatExtensionSideError(message: string): string {
  if (/extension context invalidated/i.test(message)) {
    return 'The extension was reloaded or updated. Refresh this page (F5) to continue.';
  }
  return message;
}
