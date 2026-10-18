/**
 * Browser wiring for history + upload: installs the capture observer, flushes the outbox
 * (app start, `online`, after a record, backoff timer) and exposes the actions the UI calls.
 * Engine modules stay pure; this file is the only place that touches `window`, `fetch` and the store.
 */
import { useCodeStore } from './store';
import { browserKV, type KV } from './kv';
import { clearHistory, pruneHistory } from './history';
import { editRecordFlagsCore } from './flagEdit';
import { installHistoryCapture } from './historyCapture';
import { loadPrefs, savePrefs, type Enrollment, type Identity, type Prefs, type Retention } from './prefs';
import {
  backfillCandidates,
  browserLock,
  clearOutbox,
  enqueueBackfill,
  enqueueOrRevert,
  enroll,
  flushOutbox,
  nextDueAt,
  unenroll,
  type FlushDeps,
  type FlushOptions,
} from './outbox';
import { buildPayload, buildTestPayload, sendPayload, type SendResult } from './upload';

export const kv: KV | null = browserKV();

// A tiny change signal so React can re-read storage (history, outbox, prefs) after any write.
const listeners = new Set<() => void>();
let version = 0;
export const getServiceVersion = (): number => version;
export function subscribeService(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function notify(): void {
  version += 1;
  listeners.forEach((fn) => fn());
}

const sendDeps = () => ({
  fetch: ((input: RequestInfo | URL, init?: RequestInit) => window.fetch(input, init)) as typeof fetch,
  isOnline: () => navigator.onLine,
});

let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function scheduleNext(): void {
  if (!kv) return;
  if (timer != null) clearTimeout(timer);
  timer = null;
  const due = nextDueAt(kv);
  if (due != null) timer = setTimeout(() => void flushNow(), Math.max(1000, due - Date.now()));
}

export async function flushNow(opts: FlushOptions = {}): Promise<void> {
  if (!kv || flushing) return;
  flushing = true;
  try {
    const deps: FlushDeps = { kv, now: Date.now, ...sendDeps(), lock: browserLock(), onChange: notify };
    await flushOutbox(deps, opts);
  } catch (e) {
    console.error('[upload] flush failed', e);
  } finally {
    flushing = false;
    notify();
    scheduleNext();
  }
}

export function startService(): void {
  if (!kv || typeof window === 'undefined') return;
  const store = kv;
  installHistoryCapture(useCodeStore, {
    kv: store,
    now: Date.now,
    onChanged: notify,
    onRecorded: (rec, sbar) => {
      const prefs = loadPrefs(store);
      if (!prefs.enrollment) return;
      enqueueOrRevert(store, rec, buildPayload(rec, { enrollmentKey: prefs.enrollment.key, sbar }), Date.now(), prefs.retention);
      notify();
      void flushNow();
    },
  });
  // After an offline stretch every entry is sitting in a long backoff; coming back online must not wait it out.
  window.addEventListener('online', () => void flushNow({ ignoreBackoff: true }));
  window.addEventListener('storage', notify); // another tab changed history / outbox / prefs
  void flushNow({ atStart: true });
}

export const getPrefs = (): Prefs => loadPrefs(kv);

export function setRetention(retention: Retention): void {
  if (!kv) return;
  savePrefs(kv, { ...loadPrefs(kv), retention });
  pruneHistory(kv, retention);
  notify();
}

/** Local clinician identification (name + role); printed on exports, never sent with uploads. */
export function setIdentity(identity: Identity): void {
  if (!kv) return;
  savePrefs(kv, { ...loadPrefs(kv), identity });
  notify();
}

/** Edit a history record's flags; an enrolled device re-uploads the change (statistics only, no sbar). */
export function editRecordFlags(id: string, patch: { training?: boolean; voided?: boolean }): void {
  if (!kv) return;
  const prefs = loadPrefs(kv);
  const rec = editRecordFlagsCore(kv, useCodeStore, id, patch);
  if (rec && prefs.enrollment) {
    enqueueOrRevert(kv, rec, buildPayload(rec, { enrollmentKey: prefs.enrollment.key }), Date.now(), prefs.retention);
    void flushNow();
  }
  notify();
}

export function enrollDevice(e: Enrollment): void {
  if (!kv) return;
  enroll(kv, e);
  notify();
}

export function unenrollDevice(): void {
  if (!kv) return;
  unenroll(kv);
  notify();
}

/** Settings → "Send test record": one immediate attempt, result shown inline, never queued. */
export async function sendTestRecord(): Promise<SendResult | 'not_enrolled'> {
  if (!kv) return 'not_enrolled';
  const prefs = loadPrefs(kv);
  if (!prefs.enrollment) return 'not_enrolled';
  return sendPayload(buildTestPayload(prefs.deviceId, prefs.enrollment.key, Date.now()), prefs.enrollment.url, sendDeps());
}

export const backfillCount = (): number => (kv ? backfillCandidates(kv).length : 0);

export function sendBackfill(): number {
  if (!kv) return 0;
  const n = enqueueBackfill(kv, Date.now());
  notify();
  void flushNow();
  return n;
}

export function clearAllHistory(): void {
  if (!kv) return;
  clearHistory(kv);
  clearOutbox(kv);
  notify();
}
