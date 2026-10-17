/**
 * Wake Lock — the screen must never dim or sleep while a code is running.
 *
 * The browser releases the lock whenever the page becomes hidden, so we
 * re-acquire on visibilitychange. All access is guarded so the app behaves on
 * browsers without the API (older Safari) — the UI surfaces a fallback badge.
 */

// Minimal structural types so this compiles regardless of the DOM lib version.
interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

type NavWithWakeLock = Navigator & { wakeLock?: WakeLockLike };

let sentinel: WakeLockSentinelLike | null = null;
let listenerAttached = false;
const subscribers = new Set<(active: boolean) => void>();

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export function isWakeLockActive(): boolean {
  return sentinel != null && !sentinel.released;
}

function notify(): void {
  const active = isWakeLockActive();
  subscribers.forEach((fn) => fn(active));
}

export function subscribeWakeLock(fn: (active: boolean) => void): () => void {
  subscribers.add(fn);
  fn(isWakeLockActive());
  return () => subscribers.delete(fn);
}

let wantLock = false;
// The single in-flight acquisition, shared by every caller until it settles.
let inflight: Promise<void> | null = null;

// Registered for as long as a lock is wanted (not only after a first success),
// so a failed first request (low-battery mode, opened while hidden) is retried
// when the tab becomes visible.
function onVisibilityChange(): void {
  if (document.visibilityState === 'visible' && wantLock && !isWakeLockActive()) {
    void acquire();
  }
}

function attachVisibilityListener(): void {
  if (listenerAttached || typeof document === 'undefined') return;
  listenerAttached = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function detachVisibilityListener(): void {
  if (!listenerAttached) return;
  listenerAttached = false;
  document.removeEventListener('visibilitychange', onVisibilityChange);
}

function acquire(): Promise<void> {
  if (inflight) return inflight;
  const nav = navigator as NavWithWakeLock;
  if (!nav.wakeLock) return Promise.resolve();
  const wl = nav.wakeLock;
  inflight = (async () => {
    try {
      const s = await wl.request('screen');
      if (!wantLock) {
        // Released while the request was in flight: never keep this sentinel.
        try {
          await s.release();
        } catch {
          /* ignore */
        }
        return;
      }
      sentinel = s;
      // Auto re-acquire if the platform drops the lock while we still want it.
      s.addEventListener('release', () => {
        if (sentinel !== s) return; // stale: we released it ourselves
        if (wantLock && document.visibilityState === 'visible') void acquire();
        else notify();
      });
    } catch {
      /* request refused; the visibility listener retries */
    } finally {
      inflight = null;
      notify();
    }
  })();
  return inflight;
}

export async function requestWakeLock(): Promise<void> {
  wantLock = true;
  attachVisibilityListener();
  if (isWakeLockActive()) return;
  await acquire();
}

export async function releaseWakeLock(): Promise<void> {
  wantLock = false;
  detachVisibilityListener();
  const s = sentinel;
  sentinel = null;
  if (s && !s.released) {
    try {
      await s.release();
    } catch {
      /* ignore */
    }
  }
  notify();
}
