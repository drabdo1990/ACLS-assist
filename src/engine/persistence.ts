/**
 * Persistence — localStorage auto-save so an accidental page refresh, a screen
 * rotation, or the OS killing a backgrounded tab never loses a code.
 *
 * No PHI is stored: the payload contains only timestamps, dosing inputs, and
 * event labels. Nothing leaves the device unless an admin has enrolled it for upload (see history.ts / outbox.ts).
 */

import type {
  CauseId,
  CodeEvent,
  EventCategory,
  MetronomeState,
  PersistedSession,
  SessionStatus,
  Settings,
} from './types';
import { CODE_ENDED_LABEL, REARREST_LABEL } from './eventQueries';

export const STORAGE_KEY = 'resuscode.session.v2';
/** Where an unreadable payload is parked so it is never silently destroyed. */
export const CORRUPT_STORAGE_KEY = 'resuscode.session.v2.corrupt';
/** A saved active/paused/ROSC session older than this is probably a previous code. */
export const STALE_SESSION_MS = 6 * 3_600_000;
/** Pre-rename (CodeOR) key — migrated once on load, then removed. */
export const LEGACY_STORAGE_KEY = 'codeor.session.v1';

export const DEFAULT_WEIGHT_KG = 70;

export function emptySession(): PersistedSession {
  return {
    version: 4,
    population: 'adult',
    status: 'idle',
    startedAt: null,
    pausedAt: null,
    pausedAccumMs: 0,
    endedAt: null,
    roscAccumMs: 0,
    training: false,
    voided: false,
    cycleStartedAt: null,
    cyclePausedAccumMs: 0,
    cycleIndex: 1,
    events: [],
    shocks: [],
    epi: [],
    amio: [],
    lido: [],
    rhythmBranch: null,
    antiarrhythmic: 'amiodarone',
    airwayPlaced: false,
    airwayType: null,
    causes: {},
    pocus: {},
    metronome: { on: false, audio: true, haptic: true, bpm: 110 },
    weightKg: DEFAULT_WEIGHT_KG,
    weightSource: null,
    ageMonths: null,
    settings: { epiLockoutMs: 180_000, defaultJoules: 200 },
    savedAt: 0,
  };
}

const V2_CAUSES: ReadonlySet<string> = new Set<CauseId>([
  'hypovolemia',
  'hypoxia',
  'hydrogen_ion',
  'hypo_hyperkalemia',
  'hypothermia',
  'hypoglycemia',
  'tension_ptx',
  'tamponade',
  'toxins',
  'thrombosis_pulmonary',
  'thrombosis_coronary',
]);

/**
 * Upgrade a CodeOR v1 snapshot. Perioperative crisis fields are dropped, the single
 * `thrombosis` cause becomes `thrombosis_pulmonary`, and new fields get defaults.
 * Crisis events already in the log are kept (re-filed as `system`) so the audit
 * trail is never rewritten.
 */
export function migrateV1(raw: unknown): PersistedSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const v1 = raw as Record<string, unknown>;
  if (v1.version !== 1 || !Array.isArray(v1.events)) return null;

  const base = emptySession();
  const causes: Partial<Record<CauseId, boolean>> = {};
  const oldCauses = (v1.causes ?? {}) as Record<string, boolean>;
  for (const [k, on] of Object.entries(oldCauses)) {
    const id = k === 'thrombosis' ? 'thrombosis_pulmonary' : k;
    if (V2_CAUSES.has(id)) causes[id as CauseId] = !!on;
  }

  const events = (v1.events as PersistedSession['events']).map((e) =>
    (e.category as string) === 'crisis' ? { ...e, category: 'system' as const } : e,
  );

  const session: PersistedSession = {
    ...base,
    status: (v1.status as PersistedSession['status']) ?? base.status,
    startedAt: (v1.startedAt as number | null) ?? null,
    pausedAt: (v1.pausedAt as number | null) ?? null,
    pausedAccumMs: (v1.pausedAccumMs as number) ?? 0,
    cycleStartedAt: (v1.cycleStartedAt as number | null) ?? null,
    cyclePausedAccumMs: (v1.cyclePausedAccumMs as number) ?? 0,
    cycleIndex: (v1.cycleIndex as number) ?? 1,
    events,
    shocks: (v1.shocks as PersistedSession['shocks']) ?? [],
    epi: (v1.epi as PersistedSession['epi']) ?? [],
    amio: (v1.amio as PersistedSession['amio']) ?? [],
    airwayPlaced: !!v1.airwayPlaced,
    airwayType: v1.airwayPlaced ? 'ETT' : null,
    causes,
    metronome: { ...base.metronome, ...((v1.metronome as object) ?? {}) },
    weightKg: (v1.weightKg as number) ?? DEFAULT_WEIGHT_KG,
    settings: { ...base.settings, ...((v1.settings as object) ?? {}) },
    savedAt: (v1.savedAt as number) ?? 0,
  };
  const clock = deriveClockFromEvents(session.events, session.status, session.pausedAt);
  return { ...session, ...clock, pausedAccumMs: Math.max(0, session.pausedAccumMs - clock.roscAccumMs) };
}

/** Clock fields derived from the event log — upgrades v1/v2 snapshots (whose pausedAccumMs mixed ROSC time in). */
export function deriveClockFromEvents(
  events: CodeEvent[],
  status: SessionStatus,
  pausedAt: number | null,
): { roscAccumMs: number; endedAt: number | null } {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  let open: number | null = null;
  let lastRosc: number | null = null;
  let codeEnded: number | null = null;
  let roscAccumMs = 0;
  for (const e of sorted) {
    if (e.category === 'rosc') {
      open = e.at;
      lastRosc = e.at;
    } else if (e.category === 'system' && e.label === REARREST_LABEL && open != null) {
      roscAccumMs += Math.max(0, e.at - open);
      open = null;
    } else if (e.category === 'system' && e.label === CODE_ENDED_LABEL) {
      codeEnded = e.at;
    }
  }
  // A code terminated while still in ROSC (no Re-arrest after the last ROSC) froze at ROSC, not at "Code ended".
  const endedAt =
    status === 'rosc'
      ? (lastRosc ?? pausedAt)
      : status === 'terminated'
        ? (open ?? codeEnded ?? pausedAt)
        : null;
  return { roscAccumMs, endedAt };
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

const STATUSES: ReadonlySet<string> = new Set(['idle', 'active', 'paused', 'rosc', 'terminated']);
const CATEGORIES: ReadonlySet<string> = new Set<EventCategory>([
  'system',
  'cycle',
  'cpr',
  'airway',
  'drug',
  'shock',
  'rhythm',
  'cause',
  'pocus',
  'rosc',
  'post',
]);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const validEvent = (e: unknown) =>
  isObj(e) &&
  typeof e.id === 'string' &&
  isNum(e.at) &&
  isNum(e.t) &&
  typeof e.category === 'string' &&
  CATEGORIES.has(e.category) &&
  typeof e.label === 'string' &&
  (e.detail === undefined || typeof e.detail === 'string');

const KEY_RE = /^[a-zA-Z0-9_.-]+$/;

function sanitizeEvent(raw: unknown): CodeEvent {
  const e = raw as Record<string, unknown>;
  const ev: CodeEvent = {
    id: e.id as string,
    at: e.at as number,
    t: e.t as number,
    category: e.category as EventCategory,
    label: e.label as string,
  };
  if (typeof e.detail === 'string') ev.detail = e.detail;

  // A key is kept only with valid params (or none): a key without its params would render a raw
  // "{n}" in Arabic, so an invalid pair is dropped and the event shows its English text instead.
  const validParams = (p: unknown) => isObj(p) && Object.values(p).every((v) => typeof v === 'string' || isNum(v));

  if (typeof e.key === 'string' && KEY_RE.test(e.key)) {
    if (e.params === undefined) {
      ev.key = e.key;
    } else if (validParams(e.params)) {
      ev.key = e.key;
      ev.params = e.params as Record<string, string | number>;
    }
  }

  if (typeof e.detailKey === 'string' && KEY_RE.test(e.detailKey)) {
    if (e.detailParams === undefined) {
      ev.detailKey = e.detailKey;
    } else if (validParams(e.detailParams)) {
      ev.detailKey = e.detailKey;
      ev.detailParams = e.detailParams as Record<string, string | number>;
    }
  }

  return ev;
}
const validDose = (e: unknown) =>
  isObj(e) && isNum(e.at) && isNum(e.t) && typeof e.label === 'string' &&
  (e.mg === undefined || e.mg === null || isNum(e.mg));
const validShock = (e: unknown) =>
  isObj(e) && isNum(e.at) && isNum(e.t) && isNum(e.joules) && typeof e.shockable === 'boolean';
const validFlagMap = (v: unknown) => isObj(v) && Object.values(v).every((x) => typeof x === 'boolean');

/** Missing -> default; present and valid -> value; present and invalid -> undefined (reject). */
function field<T>(v: unknown, ok: (x: unknown) => boolean, fallback: T): T | undefined {
  if (v === undefined) return fallback;
  return ok(v) ? (v as T) : undefined;
}
const arrayOf = (fn: (x: unknown) => boolean) => (v: unknown) => Array.isArray(v) && v.every(fn);

/**
 * Runtime validation of a stored v2/v3/v4 snapshot (v2 upgrades to v3 clock fields; v2/v3
 * upgrade to v4 population/weight metadata as adult). Clinical / time / event structure that
 * is malformed rejects the whole payload (so it is never presented as a trustworthy session);
 * cosmetic preferences (metronome, settings) fall back to defaults field by field.
 */
export function sanitizeSession(raw: unknown): PersistedSession | null {
  if (!isObj(raw) || (raw.version !== 2 && raw.version !== 3 && raw.version !== 4)) return null;
  const base = emptySession();

  if (typeof raw.status !== 'string' || !STATUSES.has(raw.status)) return null;
  const status = raw.status as PersistedSession['status'];

  const rawEvents = field(raw.events, arrayOf(validEvent), base.events);
  const events = rawEvents?.map(sanitizeEvent);
  const shocks = field(raw.shocks, arrayOf(validShock), base.shocks);
  const epi = field(raw.epi, arrayOf(validDose), base.epi);
  const amio = field(raw.amio, arrayOf(validDose), base.amio);
  const lido = field(raw.lido, arrayOf(validDose), base.lido);
  const causes = field(raw.causes, validFlagMap, base.causes);
  const pocus = field(raw.pocus, validFlagMap, base.pocus);
  const nullableNum = (x: unknown) => x === null || isNum(x);
  const startedAt = field<number | null>(raw.startedAt, nullableNum, null);
  const pausedAt = field<number | null>(raw.pausedAt, nullableNum, null);
  const cycleStartedAt = field<number | null>(raw.cycleStartedAt, nullableNum, null);
  const nonNegative = (x: unknown) => isNum(x) && x >= 0;
  const pausedAccumMs = field(raw.pausedAccumMs, nonNegative, 0);
  const cyclePausedAccumMs = field(raw.cyclePausedAccumMs, nonNegative, 0);
  const isBool = (x: unknown) => typeof x === 'boolean';
  const endedAtRaw = field<number | null>(raw.endedAt, nullableNum, null);
  const roscAccumRaw = field(raw.roscAccumMs, nonNegative, 0);
  const training = field(raw.training, isBool, false);
  const voided = field(raw.voided, isBool, false);
  const rhythmBranch = field<PersistedSession['rhythmBranch']>(
    raw.rhythmBranch,
    (x) => x === null || x === 'shockable' || x === 'nonshockable',
    null,
  );
  const antiarrhythmic = field<PersistedSession['antiarrhythmic']>(
    raw.antiarrhythmic,
    (x) => x === 'amiodarone' || x === 'lidocaine',
    base.antiarrhythmic,
  );
  const airwayType = field<PersistedSession['airwayType']>(
    raw.airwayType,
    (x) => x === null || x === 'ETT' || x === 'SGA',
    null,
  );
  const airwayPlaced = field(raw.airwayPlaced, (x) => typeof x === 'boolean', false);

  // v4 population / weight metadata (spec 4a §4). Population is safety-critical — doses depend
  // on it — so an invalid value rejects the session; weight fields degrade to null ("Set weight").
  const isV4 = raw.version === 4;
  const population =
    isV4 ? (raw.population === 'adult' || raw.population === 'pediatric' ? raw.population : undefined) : 'adult';
  const weightSource =
    isV4 && (raw.weightSource === 'measured' || raw.weightSource === 'estimated') ? raw.weightSource : null;
  const ageMonths =
    isV4 && isNum(raw.ageMonths) && Number.isInteger(raw.ageMonths) && raw.ageMonths >= 0 && raw.ageMonths <= 216
      ? raw.ageMonths
      : null;
  // Range follows the population: the adult slider allows 30–250 kg (store.setWeight), pediatric 0.5–150.
  const [minKg, maxKg] = population === 'pediatric' ? [0.5, 150] : [30, 250];
  const weightKg = isV4
    ? isNum(raw.weightKg) && raw.weightKg >= minKg && raw.weightKg <= maxKg
      ? raw.weightKg
      : null
    : isNum(raw.weightKg)
      ? raw.weightKg
      : DEFAULT_WEIGHT_KG;

  if (
    events === undefined || shocks === undefined || epi === undefined || amio === undefined ||
    lido === undefined || causes === undefined || pocus === undefined || startedAt === undefined ||
    pausedAt === undefined || cycleStartedAt === undefined || pausedAccumMs === undefined ||
    cyclePausedAccumMs === undefined || rhythmBranch === undefined || antiarrhythmic === undefined ||
    airwayType === undefined || airwayPlaced === undefined || endedAtRaw === undefined ||
    roscAccumRaw === undefined || training === undefined || voided === undefined ||
    population === undefined
  ) {
    return null;
  }

  // Cross-field invariants: a running / frozen clock needs its anchors.
  if (status !== 'idle' && startedAt == null) return null;
  if ((status === 'paused' || status === 'rosc' || status === 'terminated') && pausedAt == null) return null;

  // v2 → v3: pausedAccumMs mixed ROSC time in; rebuild the clock from the log.
  let endedAt = endedAtRaw;
  let roscAccumMs = roscAccumRaw;
  let cprPausedMs = pausedAccumMs;
  if (raw.version === 2) {
    const clock = deriveClockFromEvents(events, status, pausedAt);
    endedAt = clock.endedAt;
    roscAccumMs = clock.roscAccumMs;
    cprPausedMs = Math.max(0, pausedAccumMs - clock.roscAccumMs);
  } else if ((status === 'rosc' || status === 'terminated') && endedAt == null) {
    return null;
  }

  const metro = isObj(raw.metronome) ? raw.metronome : {};
  const metronome: MetronomeState = {
    on: typeof metro.on === 'boolean' ? metro.on : base.metronome.on,
    audio: typeof metro.audio === 'boolean' ? metro.audio : base.metronome.audio,
    haptic: typeof metro.haptic === 'boolean' ? metro.haptic : base.metronome.haptic,
    bpm: isNum(metro.bpm) && metro.bpm > 0 ? metro.bpm : base.metronome.bpm,
  };
  const set = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = {
    epiLockoutMs: isNum(set.epiLockoutMs) && set.epiLockoutMs > 0 ? set.epiLockoutMs : base.settings.epiLockoutMs,
    defaultJoules: isNum(set.defaultJoules) && set.defaultJoules > 0 ? set.defaultJoules : base.settings.defaultJoules,
  };

  return {
    version: 4,
    population,
    status,
    startedAt,
    pausedAt,
    pausedAccumMs: cprPausedMs,
    endedAt,
    roscAccumMs,
    training,
    voided,
    cycleStartedAt,
    cyclePausedAccumMs,
    cycleIndex: isNum(raw.cycleIndex) && raw.cycleIndex >= 1 ? Math.floor(raw.cycleIndex) : base.cycleIndex,
    events,
    shocks,
    epi,
    amio,
    lido,
    rhythmBranch,
    antiarrhythmic,
    airwayPlaced,
    airwayType,
    causes,
    pocus,
    metronome,
    weightKg,
    weightSource,
    ageMonths,
    settings,
    savedAt: isNum(raw.savedAt) ? raw.savedAt : 0,
  };
}

/** True when a saved in-progress session is old enough to be a previous code, not this one. */
export function isStaleSession(s: Pick<PersistedSession, 'status' | 'savedAt'>, now: number): boolean {
  const inProgress = s.status === 'active' || s.status === 'paused' || s.status === 'rosc';
  return inProgress && s.savedAt > 0 && now - s.savedAt > STALE_SESSION_MS;
}

/** Park an unreadable payload under a separate key and clear the live one so boot cannot loop on it. */
function quarantine(raw: string): void {
  try {
    window.localStorage.setItem(CORRUPT_STORAGE_KEY, raw);
  } catch {
    return; // storage full: keep the only copy rather than destroy a code in progress
  }
  window.localStorage.removeItem(STORAGE_KEY);
}

export function loadPersisted(): PersistedSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        /* truncated / not JSON — handled below */
      }
      const session = sanitizeSession(parsed);
      if (!session) quarantine(raw);
      return session;
    }
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    const migrated = migrateV1(JSON.parse(legacy));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    if (migrated) writePersisted(migrated);
    return migrated;
  } catch {
    return null;
  }
}

// --- Save status -------------------------------------------------------------
// The in-memory session keeps working when storage fails, so the UI must be able to say
// "not saved" instead of letting the clinician assume the latest state is durable.
let saveOk = true;
const saveListeners = new Set<() => void>();
export const getSaveOk = (): boolean => saveOk;
export function subscribeSaveStatus(fn: () => void): () => void {
  saveListeners.add(fn);
  return () => {
    saveListeners.delete(fn);
  };
}
function setSaveOk(ok: boolean): void {
  if (ok === saveOk) return;
  saveOk = ok;
  saveListeners.forEach((fn) => fn());
}

/** Lets other storage writers (history) surface a failure through the same NOT SAVED chip. */
export function reportSaveStatus(ok: boolean): void {
  setSaveOk(ok);
}

/** Returns whether the write succeeded (quota / blocked storage -> false). */
export function writePersisted(session: PersistedSession): boolean {
  if (!isBrowser()) return true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setSaveOk(true);
    return true;
  } catch {
    setSaveOk(false);
    return false;
  }
}

export function clearPersisted(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Debounced writer: the store mutates frequently, so we coalesce writes.
 * `flush` is called on pagehide to guarantee the final state is durable.
 */
export function createDebouncedWriter(delayMs = 400) {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let pending: PersistedSession | null = null;

  const flush = () => {
    if (handle != null) {
      clearTimeout(handle);
      handle = null;
    }
    if (pending) {
      writePersisted(pending);
      pending = null;
    }
  };

  const save = (session: PersistedSession) => {
    pending = session;
    if (handle != null) return;
    handle = setTimeout(() => {
      handle = null;
      if (pending) {
        writePersisted(pending);
        pending = null;
      }
    }, delayMs);
  };

  return { save, flush };
}
