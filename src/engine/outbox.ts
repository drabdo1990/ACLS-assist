/**
 * Upload outbox — one coalesced payload per record, with backoff. Exists ONLY while the device is
 * enrolled: nothing is queued, stored or sent before enrollment. Spec §5.2.
 */
import type { KV } from './kv';
import { loadPrefs, savePrefs, type Enrollment, type Retention } from './prefs';
import { loadHistory, pruneHistory, updateRecord, updateRecords, type CodeRecord, type UploadStatus } from './history';
import { buildPayload, isRejectError, sendPayload, type RejectError, type SendDeps, type UploadPayload } from './upload';
import { canWriteSession } from './tabLock';

export const OUTBOX_KEY = 'resuscode.outbox.v1';
const MAX_BACKOFF_MS = 300_000;
// ~20 server errors at the 5-minute backoff cap is nearly two hours; offline/network failures never count.
const MAX_SERVER_ERRORS = 20;
// A dead script URL never answers readably, so its entries would pile up in the localStorage the live code autosaves to.
const MAX_ENTRY_AGE_MS = 30 * 86_400_000;

export interface OutboxEntry {
  payload: UploadPayload;
  attempts: number;
  nextAttemptAt: number;
  /** delivered via a no-cors request: the reply could not be read, so resend once on next start */
  unconfirmed: boolean;
  /** replies of `{ok:false,error:'server'}` for this record; at MAX_SERVER_ERRORS it is dropped as unsendable */
  serverErrors?: number;
  /** when it was queued; older than MAX_ENTRY_AGE_MS it is dropped (absent on entries saved by older builds) */
  queuedAt?: number;
}
export interface OutboxState {
  entries: Record<string, OutboxEntry>;
  lastRejection: { error: RejectError; at: number } | null;
}

const emptyOutbox = (): OutboxState => ({ entries: {}, lastRejection: null });

export function loadOutbox(kv: KV): OutboxState {
  try {
    const raw = kv.get(OUTBOX_KEY);
    if (!raw) return emptyOutbox();
    const p = JSON.parse(raw) as { entries?: Record<string, Record<string, unknown>>; lastRejection?: Record<string, unknown> | null };
    if (!p || typeof p.entries !== 'object' || p.entries === null) return emptyOutbox();
    const entries: Record<string, OutboxEntry> = {};
    for (const [id, e] of Object.entries(p.entries)) {
      const payload = e?.payload as UploadPayload | undefined;
      if (payload && payload.recordId === id && typeof e.attempts === 'number' && typeof e.nextAttemptAt === 'number') {
        entries[id] = {
          payload,
          attempts: e.attempts,
          nextAttemptAt: e.nextAttemptAt,
          unconfirmed: !!e.unconfirmed,
          ...(typeof e.serverErrors === 'number' ? { serverErrors: e.serverErrors } : {}),
          ...(typeof e.queuedAt === 'number' ? { queuedAt: e.queuedAt } : {}),
        };
      }
    }
    const lr = p.lastRejection;
    const lastRejection = lr && isRejectError(lr.error) && typeof lr.at === 'number' ? { error: lr.error, at: lr.at } : null;
    return { entries, lastRejection };
  } catch {
    return emptyOutbox();
  }
}

function saveOutbox(kv: KV, state: OutboxState): boolean {
  if (!canWriteSession()) return false;
  return kv.set(OUTBOX_KEY, JSON.stringify(state));
}

export function clearOutbox(kv: KV): void {
  if (!canWriteSession()) return;
  kv.remove(OUTBOX_KEY);
}

/** Delay after the n-th consecutive failure: 1 s, 2 s, 4 s … capped at 5 min. */
export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempts - 1));
}

function addEntry(state: OutboxState, payload: UploadPayload, now: number): void {
  const old = state.entries[payload.recordId];
  const merged =
    payload.sbar === undefined && old?.payload.sbar !== undefined ? { ...payload, sbar: old.payload.sbar } : payload;
  state.entries[payload.recordId] = { payload: merged, attempts: 0, nextAttemptAt: now, unconfirmed: false, queuedAt: now };
}

export function enqueue(kv: KV, payload: UploadPayload, now: number): boolean {
  if (!loadPrefs(kv).enrollment) return false;
  const state = loadOutbox(kv);
  addEntry(state, payload, now);
  return saveOutbox(kv, state);
}

/**
 * Enqueue a just-recorded code. If the outbox cannot be saved (storage full), put the record back to
 * 'local' so Backfill can retry it: a 'queued' record with no outbox entry is never sent.
 */
export function enqueueOrRevert(kv: KV, rec: CodeRecord, payload: UploadPayload, now: number, retention: Retention): boolean {
  const ok = enqueue(kv, payload, now);
  if (!ok) updateRecord(kv, rec.id, { uploadStatus: 'local' }, retention);
  return ok;
}

/** Earliest time a retry is due (unconfirmed entries wait for the next app start), or null. */
export function nextDueAt(kv: KV): number | null {
  const due = Object.values(loadOutbox(kv).entries)
    .filter((e) => !e.unconfirmed)
    .map((e) => e.nextAttemptAt);
  return due.length ? Math.min(...due) : null;
}

export interface FlushDeps extends SendDeps {
  kv: KV;
  now: () => number;
  /** Cross-tab mutual exclusion; resolves undefined when the lock is not granted. */
  lock?: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  onChange?: () => void;
}
export interface FlushSummary {
  sent: number;
  rejected: number;
  failed: number;
  unconfirmed: number;
}

export function browserLock(): FlushDeps['lock'] | undefined {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return undefined;
  return <T>(fn: () => Promise<T>) =>
    navigator.locks.request('resuscode-outbox', { ifAvailable: true }, async (lock) => (lock ? fn() : undefined)) as Promise<T | undefined>;
}

export interface FlushOptions {
  /** App start: also re-send entries that were delivered unconfirmed (once). */
  atStart?: boolean;
  /** The `online` event: connectivity just came back, so entries still waiting out an offline backoff are due now. */
  ignoreBackoff?: boolean;
}

export async function flushOutbox(deps: FlushDeps, opts: FlushOptions = {}): Promise<FlushSummary> {
  const summary: FlushSummary = { sent: 0, rejected: 0, failed: 0, unconfirmed: 0 };

  const run = async (): Promise<FlushSummary> => {
    const { kv } = deps;
    if (!canWriteSession()) return summary;
    const prefs = loadPrefs(kv);
    if (!prefs.enrollment) return summary;
    const setStatus = (id: string, uploadStatus: UploadStatus) => updateRecord(kv, id, { uploadStatus }, prefs.retention);

    // Start the clock on entries from older builds; drop stuck ones back to 'local' so Backfill can resend them
    // once the destination works again.
    const aged = loadOutbox(kv);
    let agedChanged = false;
    for (const [id, e] of Object.entries(aged.entries)) {
      if (e.queuedAt === undefined) e.queuedAt = deps.now();
      else if (deps.now() - e.queuedAt > MAX_ENTRY_AGE_MS) {
        delete aged.entries[id];
        setStatus(id, 'local');
      } else continue;
      agedChanged = true;
    }
    if (agedChanged) saveOutbox(kv, aged);

    const due = Object.values(loadOutbox(kv).entries)
      .filter((e) => (e.unconfirmed ? !!opts.atStart : !!opts.ignoreBackoff || e.nextAttemptAt <= deps.now()))
      .sort((a, b) => a.payload.startEpochMs - b.payload.startEpochMs);

    for (const entry of due) {
      let stop = false;
      const id = entry.payload.recordId;
      const res = await sendPayload({ ...entry.payload, enrollmentKey: prefs.enrollment.key }, prefs.enrollment.url, deps);

      // Re-read: a newer payload may have been coalesced while the request was in flight.
      const state = loadOutbox(kv);
      const current = state.entries[id];
      if (!current || JSON.stringify(current.payload) !== JSON.stringify(entry.payload)) continue;

      if (res.status === 'sent') {
        delete state.entries[id];
        state.lastRejection = null;
        setStatus(id, 'sent');
        summary.sent += 1;
      } else if (res.status === 'rejected') {
        delete state.entries[id];
        state.lastRejection = { error: res.error, at: deps.now() };
        setStatus(id, 'rejected');
        summary.rejected += 1;
      } else if (res.status === 'sent_unconfirmed') {
        if (entry.unconfirmed) delete state.entries[id]; // its one extra send is done
        else current.unconfirmed = true;
        setStatus(id, 'sent_unconfirmed');
        summary.unconfirmed += 1;
      } else {
        // The script answered 'server' for THIS record (bad value it cannot store); anything else is connectivity.
        const recordFault = res.reason === 'server_server';
        if (recordFault) current.serverErrors = (current.serverErrors ?? 0) + 1;
        if ((current.serverErrors ?? 0) >= MAX_SERVER_ERRORS) {
          delete state.entries[id];
          setStatus(id, 'rejected');
          summary.rejected += 1;
        } else {
          current.attempts += 1;
          current.unconfirmed = false;
          current.nextAttemptAt = deps.now() + backoffMs(current.attempts);
          setStatus(id, 'failed');
          summary.failed += 1;
        }
        stop = !recordFault; // offline / busy / timeout: the next record would fail the same way, 30 s each
      }
      saveOutbox(kv, state);
      deps.onChange?.();
      if (stop) break;
    }
    return summary;
  };

  const out = deps.lock ? await deps.lock(run) : await run();
  return out ?? summary;
}

export function backfillCandidates(kv: KV): CodeRecord[] {
  return loadHistory(kv).filter((r) => r.uploadStatus === 'local');
}

/** Queue every earlier (local) record, statistics only (no sbar). Returns how many were queued. */
export function enqueueBackfill(kv: KV, now: number): number {
  const prefs = loadPrefs(kv);
  if (!prefs.enrollment) return 0;
  const candidates = backfillCandidates(kv);
  if (!candidates.length) return 0;
  const state = loadOutbox(kv);
  for (const r of candidates) addEntry(state, buildPayload(r, { enrollmentKey: prefs.enrollment.key }), now);
  if (!saveOutbox(kv, state)) return 0;
  updateRecords(kv, candidates.map((r) => r.id), { uploadStatus: 'queued' }, prefs.retention);
  return candidates.length;
}

export function enroll(kv: KV, enrollment: Enrollment): void {
  const prefs = loadPrefs(kv);
  const newDestination = prefs.enrollment?.url !== enrollment.url;
  savePrefs(kv, { ...prefs, enrollment });
  const state = loadOutbox(kv);
  state.lastRejection = null;
  if (newDestination) state.entries = {}; // payloads built for the old sheet must not leak into the new one
  saveOutbox(kv, state);
  if (newDestination) {
    for (const r of loadHistory(kv)) if (r.uploadStatus !== 'local') updateRecord(kv, r.id, { uploadStatus: 'local' }, prefs.retention);
  }
}

export function unenroll(kv: KV): void {
  const prefs = loadPrefs(kv);
  savePrefs(kv, { ...prefs, enrollment: null });
  clearOutbox(kv);
  for (const r of loadHistory(kv)) {
    if (r.uploadStatus === 'queued' || r.uploadStatus === 'failed' || r.uploadStatus === 'rejected') {
      updateRecord(kv, r.id, { uploadStatus: 'local' }, prefs.retention);
    }
  }
  pruneHistory(kv, prefs.retention);
}
