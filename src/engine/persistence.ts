/**
 * Persistence — localStorage auto-save so an accidental page refresh, a screen
 * rotation, or the OS killing a backgrounded tab never loses a code.
 *
 * No PHI is stored: the payload contains only timestamps, dosing inputs, and
 * event labels. Nothing ever leaves the device.
 */

import type { CauseId, PersistedSession } from './types';

export const STORAGE_KEY = 'resuscode.session.v2';
/** Pre-rename (CodeOR) key — migrated once on load, then removed. */
export const LEGACY_STORAGE_KEY = 'codeor.session.v1';

export const DEFAULT_WEIGHT_KG = 70;

export function emptySession(): PersistedSession {
  return {
    version: 2,
    status: 'idle',
    startedAt: null,
    pausedAt: null,
    pausedAccumMs: 0,
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

  return {
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
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadPersisted(): PersistedSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedSession;
      if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.events)) return null;
      return { ...emptySession(), ...parsed };
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

export function writePersisted(session: PersistedSession): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota or private-mode failure — the in-memory session still works */
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
