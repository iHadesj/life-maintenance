export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isAppleDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export async function storageStatus(): Promise<{ persisted: boolean | null; usage: number | null; quota: number | null }> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage) return { persisted: null, usage: null, quota: null };
  const [persisted, estimate] = await Promise.all([
    storage.persisted ? storage.persisted().catch(() => null) : Promise.resolve(null),
    storage.estimate ? storage.estimate().catch(() => null) : Promise.resolve(null),
  ]);
  return { persisted, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
}

/** Asks the browser not to evict IndexedDB under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.persist) return null;
  try {
    if (await storage.persisted?.()) return true;
    return await storage.persist();
  } catch {
    return null;
  }
}
