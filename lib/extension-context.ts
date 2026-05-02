import browser from '@/lib/browser';

export { formatExtensionSideError } from '@/lib/extension-errors';

/** After an extension reload/update, orphaned content scripts throw on `runtime.*` access. */
export function extensionContextIsStale(): boolean {
  try {
    return !browser.runtime.id;
  } catch {
    return true;
  }
}
