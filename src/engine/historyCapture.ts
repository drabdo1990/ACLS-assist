/**
 * History capture — a store observer that turns a finished code into a history record.
 * It must never throw out of a store `set()` (reset() especially) and never block a running code.
 * Spec §5.1.
 */
import type { PersistedSession } from './types';
import type { KV } from './kv';
import { buildRecord, upsertRecord, type CodeRecord } from './history';
import { loadPrefs } from './prefs';
import { buildSbar } from './sbar';
import { reportSaveStatus } from './persistence';

export type CaptureState = PersistedSession & { rev: number };

export interface CaptureDeps {
  kv: KV | null;
  now: () => number;
  /** Enrolled devices only: a record was created or really changed. `sbar` is English with relative times only. */
  onRecorded?: (record: CodeRecord, sbar: string) => void;
  /** After any history write, so the UI can refresh. */
  onChanged?: () => void;
}

export const DEBOUNCE_MS = 1000;

const isTerminal = (s: Pick<PersistedSession, 'status'>) => s.status === 'rosc' || s.status === 'terminated';

export function createCapture(deps: CaptureDeps) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: CaptureState | null = null;

  const cancel = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    latest = null;
  };

  function record(s: CaptureState): void {
    const { kv } = deps;
    if (!kv) return;
    const now = deps.now();
    const prefs = loadPrefs(kv);
    const rec = buildRecord(s, now, {
      deviceId: prefs.deviceId,
      unit: prefs.enrollment?.unit ?? null,
      uploadStatus: prefs.enrollment ? 'queued' : 'local',
    });
    if (!rec) return;
    const res = upsertRecord(kv, rec, prefs.retention);
    if (!res.saved) reportSaveStatus(false);
    if (!res.changed) return;
    deps.onChanged?.();
    if (prefs.enrollment) {
      deps.onRecorded?.(res.record, buildSbar({ ...s, stats: rec.stats }, now, { relativeOnly: true, lang: 'en' }));
    }
  }

  function guarded(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      console.error('[history] capture failed', e);
    }
  }

  function handle(state: CaptureState, prev: CaptureState): void {
    guarded(() => {
      // reset(): the whole state was replaced, so the finished code only exists in `prev`
      if (prev.startedAt != null && state.startedAt == null) {
        cancel();
        record(prev);
        return;
      }
      if (state.rev === prev.rev) return; // clock tick or no-op
      if (!isTerminal(state)) {
        cancel(); // e.g. re-arrest: the final state is recorded when the code ends or is reset
        return;
      }
      if (!isTerminal(prev) || state.status !== prev.status) {
        cancel();
        record(state);
        return;
      }
      latest = state;
      if (timer != null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const s = latest;
        latest = null;
        if (s) guarded(() => record(s));
      }, DEBOUNCE_MS);
    });
  }

  /** Write a pending debounced change now (pagehide / visibility hidden). */
  function flush(): void {
    guarded(() => {
      if (timer != null) clearTimeout(timer);
      timer = null;
      const s = latest;
      latest = null;
      if (s) record(s);
    });
  }

  return { handle, flush };
}

export function requestPersistentStorage(): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) void navigator.storage.persist().catch(() => {});
  } catch {
    /* best effort */
  }
}

/** Zustand's `subscribe((state, prev) => …)` satisfies this. Returns a disposer. */
export function installHistoryCapture<S extends CaptureState>(
  store: { subscribe(listener: (state: S, prev: S) => void): () => void },
  deps: CaptureDeps,
): () => void {
  const cap = createCapture(deps);
  const unsubscribe = store.subscribe(cap.handle);
  const onHide = () => cap.flush();
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
  }
  requestPersistentStorage();
  return () => {
    unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    }
  };
}
