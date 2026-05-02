/**
 * Toggle on the LinkedIn tab console:
 *   sessionStorage.setItem('lse-debug', '1')  // on (default if unset)
 *   sessionStorage.setItem('lse-debug', '0')  // off
 */
export function lseDebugEnabled(): boolean {
  try {
    const v = sessionStorage.getItem('lse-debug');
    if (v === '0' || v === 'false') {
      return false;
    }
    if (v === '1' || v === 'true') {
      return true;
    }
  } catch {
    // storage unavailable
  }
  return true;
}

export function lseDbg(message: string, data?: unknown): void {
  if (!lseDebugEnabled()) {
    return;
  }
  if (data !== undefined) {
    console.log('[salary-estimator:debug]', message, data);
  } else {
    console.log('[salary-estimator:debug]', message);
  }
}
