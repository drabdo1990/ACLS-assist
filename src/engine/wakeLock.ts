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

async function acquire(): Promise<void> {
  const nav = navigator as NavWithWakeLock;
  if (!nav.wakeLock) return;
  try {
    sentinel = await nav.wakeLock.request('screen');
    if (!listenerAttached) {
      listenerAttached = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && wantLock) void acquire();
      });
    }
    // Auto re-acquire if the platform drops the lock while we still want it.
    sentinel.addEventListener('release', () => {
      if (wantLock && document.visibilityState === 'visible') void acquire();
      else notify();
    });
    notify();
  } catch {
    notify();
  }
}

let wantLock = false;

export async function requestWakeLock(): Promise<void> {
  wantLock = true;
  if (isWakeLockActive()) return;
  await acquire();
}

export async function releaseWakeLock(): Promise<void> {
  wantLock = false;
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
