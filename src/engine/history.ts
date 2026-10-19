/**
 * Device history — a compact record of each finished code (statistics only, no event log), kept in
 * localStorage under `resuscode.history.v1`. Pure over an injected KV. Spec §5.1.
 */
import type { PersistedSession } from './types';
import { computeCodeStats, type CodeStats } from './stats';
import type { KV } from './kv';
import { DEFAULT_RETENTION, type Retention } from './prefs';
import { reportSaveStatus } from './persistence';
import { canWriteSession } from './tabLock';

export const HISTORY_KEY = 'resuscode.history.v1';
/** Where an unparseable history is parked so it is never silently destroyed. */
export const HISTORY_CORRUPT_KEY = 'resuscode.history.v1.corrupt';
export const HISTORY_CAP = 500;
export const MIN_RECORD_ARREST_MS = 60_000;
/** Aggregates show counts instead of rates below this many counted codes. */
export const MIN_RATE_N = 5;

export type UploadStatus = 'local' | 'queued' | 'sent' | 'sent_unconfirmed' | 'failed' | 'rejected';

export interface CodeRecord {
  id: string;
  deviceId: string;
  startedAt: number;
  unit: string | null;
  stats: CodeStats;
  training: boolean;
  voided: boolean;
  uploadStatus: UploadStatus;
  savedAt: number;
}

export interface RecordContext {
  deviceId: string;
  unit: string | null;
  uploadStatus: UploadStatus;
}

export const makeRecordId = (startedAt: number, deviceId: string): string => `${startedAt}-${deviceId}`;

/** ISO-8601 with an explicit UTC offset (e.g. 2026-10-16T13:30:00+03:00). */
export function isoWithOffset(ms: number, offsetMin: number = -new Date(ms).getTimezoneOffset()): string {
  const d = new Date(ms + offsetMin * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  const a = Math.abs(offsetMin);
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}` +
    `${offsetMin >= 0 ? '+' : '-'}${p(Math.floor(a / 60))}:${p(a % 60)}`
  );
}

/** Spec §5.1: ≥ 60 s of arrest, or any shock / drug / airway / rhythm / ROSC. "End code" alone does not count. */
export function shouldRecord(st: CodeStats): boolean {
  return (
    st.arrestMs >= MIN_RECORD_ARREST_MS ||
    st.shocks.count > 0 ||
    st.epi.count > 0 ||
    st.amiodarone.count > 0 ||
    st.lidocaine.count > 0 ||
    st.magnesium.count > 0 ||
    st.airway.type != null ||
    st.rhythms.length > 0 ||
    st.roscCount > 0
  );
}

export function buildRecord(s: PersistedSession, now: number, ctx: RecordContext): CodeRecord | null {
  const stats = computeCodeStats(s, now);
  if (!stats || !shouldRecord(stats)) return null;
  return {
    id: makeRecordId(stats.startedAt, ctx.deviceId),
    deviceId: ctx.deviceId,
    startedAt: stats.startedAt,
    unit: ctx.unit,
    stats,
    training: s.training,
    voided: s.voided,
    uploadStatus: ctx.uploadStatus,
    savedAt: now,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const OUTCOMES: ReadonlySet<string> = new Set(['rosc', 'rosc_then_terminated', 'terminated', 'incomplete']);
const STATUSES: ReadonlySet<string> = new Set(['local', 'queued', 'sent', 'sent_unconfirmed', 'failed', 'rejected']);

function sanitizeRecord(x: unknown): CodeRecord | null {
  if (!isObj(x)) return null;
  if (typeof x.id !== 'string' || typeof x.deviceId !== 'string' || !isNum(x.startedAt) || !isNum(x.savedAt)) return null;
  if (typeof x.training !== 'boolean' || typeof x.voided !== 'boolean') return null;
  if (typeof x.uploadStatus !== 'string' || !STATUSES.has(x.uploadStatus)) return null;
  if (!(x.unit === null || typeof x.unit === 'string')) return null;
  const st = x.stats;
  if (!isObj(st) || typeof st.outcome !== 'string' || !OUTCOMES.has(st.outcome) || !isNum(st.arrestMs) || !isNum(st.startedAt)) return null;
  // nested members the formatters / CSV / aggregates dereference must exist
  if (!isObj(st.shocks) || !isObj(st.epi) || !isObj(st.amiodarone) || !isObj(st.lidocaine) || !isObj(st.magnesium) || !isObj(st.airway)) return null;
  if (!Array.isArray(st.rhythms) || !Array.isArray(st.causes) || !Array.isArray(st.pocus)) return null;
  // Phase 4a fields: records captured by older builds (statsVersion 1) read as adult.
  if (st.population !== 'adult' && st.population !== 'pediatric') st.population = 'adult';
  if (!isNum(st.weightKg) && st.weightKg !== null) st.weightKg = null;
  if (st.weightSource !== 'measured' && st.weightSource !== 'estimated') st.weightSource = null;
  if (!isNum(st.ageMonths) && st.ageMonths !== null) st.ageMonths = null;
  if (!Array.isArray(st.shocks.joules)) return null; // the log tab, CSV and aggregates iterate it
  if (!Array.isArray(st.shocks.perKg)) st.shocks.perKg = (Array.isArray(st.shocks.joules) ? st.shocks.joules : []).map(() => null);
  // Optional fields that predate or postdate a record read as "not recorded".
  for (const key of ['firstRoscMs', 'firstShockMs', 'firstEpiMs', 'branchAtFirstEpi', 'postRosc'] as const) {
    if (st[key] === undefined) st[key] = null;
  }
  // Counters the statistics panel, CSV and aggregates read directly. A missing one would render
  // "undefined" or poison an average with NaN, so reject the record (the raw copy is backed up).
  const numOrNull = (v: unknown) => v === null || isNum(v);
  if (
    !isNum(st.shocks.count) ||
    !isNum(st.roscCount) ||
    !isNum(st.cycles) ||
    !isNum(st.pausedMs) ||
    !numOrNull(st.firstRoscMs) ||
    !numOrNull(st.firstShockMs) ||
    !numOrNull(st.firstEpiMs) ||
    !(st.branchAtFirstEpi === null || st.branchAtFirstEpi === 'shockable' || st.branchAtFirstEpi === 'nonshockable') ||
    !isNum(st.epi.count) ||
    !numOrNull(st.epi.meanIntervalMs) ||
    !numOrNull(st.epi.longestIntervalMs) ||
    typeof st.epi.longestExceedsThreshold !== 'boolean' ||
    !isNum(st.amiodarone.count) ||
    !isNum(st.amiodarone.totalMg) ||
    !isNum(st.lidocaine.count) ||
    !isNum(st.magnesium.count) ||
    !(st.airway.type === null || typeof st.airway.type === 'string') ||
    !numOrNull(st.airway.firstPlacedMs) ||
    (st.postRosc !== null && (!isObj(st.postRosc) || !isNum(st.postRosc.done) || !isNum(st.postRosc.total)))
  ) {
    return null;
  }
  for (const g of [st.epi, st.amiodarone, st.lidocaine, st.magnesium] as Array<Record<string, unknown>>) {
    if (!isNum(g.notCalculated)) g.notCalculated = 0;
  }
  return x as unknown as CodeRecord;
}

export function loadHistory(kv: KV): CodeRecord[] {
  const raw = kv.get(HISTORY_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!Array.isArray(parsed)) {
    if (canWriteSession()) {
      kv.set(HISTORY_CORRUPT_KEY, raw);
      // Do not leave an unreadable payload live: every load would re-park it and the recovery
      // notice could never clear. The raw copy is preserved above.
      kv.remove(HISTORY_KEY);
    }
    return [];
  }
  const byId = new Map<string, CodeRecord>();
  const skipped: unknown[] = [];
  for (const x of parsed) {
    const r = sanitizeRecord(x);
    if (r) byId.set(r.id, r);
    else skipped.push(x);
  }
  if (skipped.length) {
    // The next save drops these; keep the raw copies (shortcut: one slot, overwritten by the next bad load).
    const backup = JSON.stringify(skipped);
    if (kv.get(HISTORY_CORRUPT_KEY) !== backup) kv.set(HISTORY_CORRUPT_KEY, backup);
  }
  return [...byId.values()].sort((a, b) => a.startedAt - b.startedAt);
}

export function applyRetention(records: CodeRecord[], r: Retention): CodeRecord[] {
  let kept = [...records].sort((a, b) => a.startedAt - b.startedAt);
  if (r.mode === 'after_upload') kept = kept.filter((x) => x.uploadStatus !== 'sent');
  if (r.mode === 'last') kept = kept.slice(-r.keep);
  return kept.slice(-HISTORY_CAP);
}

function persist(kv: KV, records: CodeRecord[], retention: Retention): { kept: CodeRecord[]; saved: boolean } {
  const kept = applyRetention(records, retention);
  if (!canWriteSession()) return { kept, saved: false };
  const saved = kv.set(HISTORY_KEY, JSON.stringify(kept));
  reportSaveStatus(saved);
  return { kept, saved };
}

export interface UpsertResult {
  records: CodeRecord[];
  record: CodeRecord;
  /** false when the incoming data equals what is stored (the stored upload status is kept). */
  changed: boolean;
  saved: boolean;
}

const dataKey = (r: CodeRecord) => JSON.stringify([r.stats, r.training, r.voided, r.unit]);

/** Read-modify-write at write time (never from a cached copy), so two tabs converge on one row per id. */
export function upsertRecord(kv: KV, incoming: CodeRecord, retention: Retention = DEFAULT_RETENTION): UpsertResult {
  const all = loadHistory(kv);
  const i = all.findIndex((r) => r.id === incoming.id);
  if (i >= 0 && dataKey(all[i]) === dataKey(incoming)) return { records: all, record: all[i], changed: false, saved: true };
  if (i >= 0) all[i] = incoming;
  else all.push(incoming);
  const { kept, saved } = persist(kv, all, retention);
  return { records: kept, record: incoming, changed: true, saved };
}

export type RecordPatch = Partial<Pick<CodeRecord, 'training' | 'voided' | 'uploadStatus' | 'unit'>>;

export function updateRecord(kv: KV, id: string, patch: RecordPatch, retention: Retention = DEFAULT_RETENTION): CodeRecord | null {
  const all = loadHistory(kv);
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i], ...patch };
  persist(kv, all, retention);
  return all[i];
}

/** One read/write for a batch of ids (backfill); the per-id helper above stays for single edits. */
export function updateRecords(
  kv: KV,
  ids: readonly string[],
  patch: RecordPatch,
  retention: Retention = DEFAULT_RETENTION,
): void {
  const wanted = new Set(ids);
  const all = loadHistory(kv);
  let changed = false;
  for (let i = 0; i < all.length; i++) {
    if (!wanted.has(all[i].id)) continue;
    all[i] = { ...all[i], ...patch };
    changed = true;
  }
  if (changed) persist(kv, all, retention);
}

export function clearHistory(kv: KV): void {
  if (!canWriteSession()) return;
  kv.remove(HISTORY_KEY);
}

export interface Median {
  value: number | null;
  /** how many records had this metric */
  n: number;
}

export function median(values: Array<number | null | undefined>): Median {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { value: null, n: 0 };
  const mid = Math.floor(v.length / 2);
  return { value: v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2), n: v.length };
}

export interface Aggregates {
  total: number;
  /** real, finished, not voided: the denominator for every rate */
  counted: number;
  /** training or voided */
  excluded: number;
  /** real, not voided, but code not ended */
  incomplete: number;
  /** counted codes with at least one ROSC (rosc + rosc_then_terminated) */
  anyRosc: number;
  roscRate: number | null;
  /** false when counted < MIN_RATE_N: show counts, not percentages */
  showRates: boolean;
  firstEpi: Median;
  firstShock: Median;
  arrest: Median;
}

function baseAggregates(records: CodeRecord[]): Aggregates {
  const excluded = records.filter((r) => r.training || r.voided);
  const live = records.filter((r) => !r.training && !r.voided);
  const incomplete = live.filter((r) => r.stats.outcome === 'incomplete');
  const counted = live.filter((r) => r.stats.outcome !== 'incomplete');
  const anyRosc = counted.filter((r) => r.stats.outcome === 'rosc' || r.stats.outcome === 'rosc_then_terminated').length;
  return {
    total: records.length,
    counted: counted.length,
    excluded: excluded.length,
    incomplete: incomplete.length,
    anyRosc,
    roscRate: counted.length ? anyRosc / counted.length : null,
    showRates: counted.length >= MIN_RATE_N,
    firstEpi: median(counted.map((r) => r.stats.firstEpiMs)),
    firstShock: median(counted.map((r) => r.stats.firstShockMs)),
    arrest: median(counted.map((r) => r.stats.arrestMs)),
  };
}

export function computeAggregates(records: CodeRecord[]): Aggregates & {
  /** Totals and medians per population, each with its own n (phase 4a). */
  byPopulation: { adult: Aggregates; pediatric: Aggregates };
} {
  return {
    ...baseAggregates(records),
    byPopulation: {
      adult: baseAggregates(records.filter((r) => (r.stats.population ?? 'adult') === 'adult')),
      pediatric: baseAggregates(records.filter((r) => r.stats.population === 'pediatric')),
    },
  };
}

/** Re-apply a (possibly tighter) retention to the stored history, e.g. after the setting changes. */
export function pruneHistory(kv: KV, retention: Retention): void {
  persist(kv, loadHistory(kv), retention);
}
