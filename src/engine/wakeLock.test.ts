import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest runs in node (no DOM). Fake exactly the globals wakeLock.ts touches:
// navigator.wakeLock and document.visibilityState/addEventListener/removeEventListener.

class FakeSentinel {
  released = false;
  private listeners: Array<() => void> = [];
  addEventListener(_type: 'release', fn: () => void): void {
    this.listeners.push(fn);
  }
  async release(): Promise<void> {
    if (this.released) return;
    this.released = true;
    this.listeners.forEach((fn) => fn());
  }
  /** What the browser does when the page is hidden. */
  platformRelease(): void {
    void this.release();
  }
}

interface Pending {
  resolve: () => FakeSentinel;
  reject: (err: Error) => void;
}

function makeFakeWakeLock() {
  const pending: Pending[] = [];
  const sentinels: FakeSentinel[] = [];
  return {
    pending,
    sentinels,
    request: vi.fn((_type: 'screen') => {
      return new Promise<FakeSentinel>((res, rej) => {
        pending.push({
          resolve: () => {
            const s = new FakeSentinel();
            sentinels.push(s);
            res(s);
            return s;
          },
          reject: (err) => rej(err),
        });
      });
    }),
  };
}

function makeFakeDocument() {
  const listeners = new Map<string, Set<() => void>>();
  const doc = {
    visibilityState: 'visible' as 'visible' | 'hidden',
    addEventListener(type: string, fn: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn);
    },
  };
  return {
    doc,
    count: (type: string) => listeners.get(type)?.size ?? 0,
    setVisibility(state: 'visible' | 'hidden') {
      doc.visibilityState = state;
      listeners.get('visibilitychange')?.forEach((fn) => fn());
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('wakeLock', () => {
  const g = globalThis as Record<string, unknown>;
  let origNavigator: PropertyDescriptor | undefined;
  let origDocument: PropertyDescriptor | undefined;
  let lock: ReturnType<typeof makeFakeWakeLock>;
  let dom: ReturnType<typeof makeFakeDocument>;
  let mod: typeof import('./wakeLock');

  beforeEach(async () => {
    origNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    origDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    lock = makeFakeWakeLock();
    dom = makeFakeDocument();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: { wakeLock: lock },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: dom.doc,
    });
    vi.resetModules();
    mod = await import('./wakeLock');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const restore = (key: string, desc: PropertyDescriptor | undefined) => {
      if (desc) Object.defineProperty(globalThis, key, desc);
      else delete g[key];
    };
    restore('navigator', origNavigator);
    restore('document', origDocument);
  });

  it('happy path: acquires, reports active, re-acquires after the platform drops it', async () => {
    const p = mod.requestWakeLock();
    lock.pending[0].resolve();
    await p;
    expect(mod.isWakeLockActive()).toBe(true);

    // Tab hidden: browser auto-releases the lock.
    dom.setVisibility('hidden');
    lock.sentinels[0].platformRelease();
    await flush();
    expect(mod.isWakeLockActive()).toBe(false);
    expect(lock.request).toHaveBeenCalledTimes(1);

    // Tab visible again: re-acquired.
    dom.setVisibility('visible');
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(2);
    lock.pending[1].resolve();
    await flush();
    expect(mod.isWakeLockActive()).toBe(true);
  });

  it('retries on visible when the first request failed', async () => {
    dom.doc.visibilityState = 'hidden';
    const p = mod.requestWakeLock();
    lock.pending[0].reject(new Error('NotAllowedError'));
    await p;
    expect(mod.isWakeLockActive()).toBe(false);

    dom.setVisibility('visible');
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(2);
    lock.pending[1].resolve();
    await flush();
    expect(mod.isWakeLockActive()).toBe(true);
  });

  it('registers the visibility listener as soon as a lock is wanted, once', async () => {
    void mod.requestWakeLock();
    void mod.requestWakeLock();
    expect(dom.count('visibilitychange')).toBe(1);
    lock.pending[0].reject(new Error('fail'));
    await flush();
    expect(dom.count('visibilitychange')).toBe(1);
  });

  it('concurrent requests share one acquisition and one sentinel', async () => {
    const a = mod.requestWakeLock();
    const b = mod.requestWakeLock();
    expect(lock.request).toHaveBeenCalledTimes(1);
    lock.pending[0].resolve();
    await Promise.all([a, b]);
    expect(lock.sentinels).toHaveLength(1);
    expect(mod.isWakeLockActive()).toBe(true);

    // A later request while held does nothing.
    await mod.requestWakeLock();
    expect(lock.request).toHaveBeenCalledTimes(1);
  });

  it('release during an in-flight acquire releases the sentinel that resolves', async () => {
    const p = mod.requestWakeLock();
    await mod.releaseWakeLock();
    const s = lock.pending[0].resolve();
    await p;
    await flush();
    expect(s.released).toBe(true);
    expect(mod.isWakeLockActive()).toBe(false);

    // Becoming visible must not re-acquire: module ended in the released state.
    dom.setVisibility('visible');
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(1);
  });

  it('request while a stale sentinel is still being released ends up holding the lock', async () => {
    // Controllable release(): the stale sentinel's release stays pending until we open the gate.
    let openGate!: () => void;
    const gate = new Promise<void>((res) => {
      openGate = res;
    });
    vi.spyOn(FakeSentinel.prototype, 'release').mockImplementationOnce(async function (
      this: FakeSentinel,
    ) {
      await gate;
      this.released = true;
    });

    const first = mod.requestWakeLock();
    await mod.releaseWakeLock(); // lock no longer wanted while the request is in flight
    const stale = lock.pending[0].resolve();
    await flush(); // acquire() is now awaiting the stale sentinel's release()

    // The lock is wanted again while the stale release is still pending.
    const second = mod.requestWakeLock();
    await flush();

    openGate();
    await flush();
    // The second request must start its own acquisition, not join the dying one.
    while (lock.pending.length > lock.sentinels.length) {
      lock.pending[lock.sentinels.length].resolve();
      await flush();
    }
    await Promise.all([first, second]);

    expect(stale.released).toBe(true);
    expect(lock.request).toHaveBeenCalledTimes(2);
    expect(mod.isWakeLockActive()).toBe(true);
    expect(lock.sentinels[1].released).toBe(false);
  });

  it('release removes the visibility listener and releases a held sentinel', async () => {
    const p = mod.requestWakeLock();
    lock.pending[0].resolve();
    await p;
    expect(dom.count('visibilitychange')).toBe(1);

    await mod.releaseWakeLock();
    expect(dom.count('visibilitychange')).toBe(0);
    expect(lock.sentinels[0].released).toBe(true);
    expect(mod.isWakeLockActive()).toBe(false);

    dom.setVisibility('visible');
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(1);
  });
});
