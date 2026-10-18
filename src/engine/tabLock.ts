/**
 * One writer per browser profile. Two tabs sharing localStorage would otherwise overwrite each
 * other's live code. Web Locks are held for the tab's lifetime; a second tab becomes read-only.
 *
 * shortcut: browsers without Web Locks fall back to the old multi-writer behaviour,
 * upgrade to a BroadcastChannel leader election only if those browsers still matter.
 */

let blocked = false;
let started = false;
let ready: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

export function isTabBlocked(): boolean {
  return blocked;
}

export function subscribeTabBlocked(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function canWriteSession(): boolean {
  return !blocked;
}

export function startTabLock(): Promise<boolean> {
  if (ready) return ready;
  if (started || typeof navigator === 'undefined' || !navigator.locks) {
    started = true;
    ready = Promise.resolve(true);
    return ready;
  }
  started = true;
  ready = new Promise<boolean>((resolve) => {
    void navigator.locks
      .request('resuscode-session-writer', { ifAvailable: true }, async (lock) => {
        if (!lock) {
          blocked = true;
          listeners.forEach((fn) => fn());
          resolve(false);
          return;
        }
        resolve(true);
        // Hold the lock until this tab closes. Rendering keeps running in the other tab as a read-only view.
        await new Promise<void>(() => {});
      })
      .catch(() => resolve(true));
  });
  return ready;
}
