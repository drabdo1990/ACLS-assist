import { create } from 'zustand';
import type {
  CodeEvent,
  CauseId,
  CrisisTimers,
  DoseEvent,
  EventCategory,
  MetronomeState,
  PersistedSession,
  RhythmLoop,
  SessionStatus,
  Settings,
  ShockEvent,
} from './types';
import { CYCLE_MS, masterElapsedMs } from './timing';
import { createDebouncedWriter, clearPersisted, loadPersisted } from './persistence';
import { playChime, playClose, playConfirm } from './audio';
import { haptic } from './haptics';
import { CAUSES } from '../content/causes';

let idCounter = 0;
function uid(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

function mkEvent(
  category: EventCategory,
  label: string,
  detail: string | undefined,
  at: number,
  t: number,
): CodeEvent {
  return { id: uid(), at, t, category, label, detail };
}

const DEFAULT_SETTINGS: Settings = {
  epiLockoutMs: 180_000, // 3:00 (AHA range 3–5 min)
  defaultJoules: 200,
};

const DEFAULT_METRONOME: MetronomeState = {
  on: false,
  audio: true,
  haptic: true,
  bpm: 110,
};

const DEFAULT_CRISIS: CrisisTimers = {
  maternalStartedAt: null,
  cicoDeclaredAt: null,
  mhDeclaredAt: null,
  lastDeclaredAt: null,
};

const DEFAULT_WEIGHT_KG = 70;

function emptySession(): PersistedSession {
  return {
    version: 1,
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
    crisisDoses: [],
    airwayPlaced: false,
    ventilationStarted: false,
    causes: {},
    metronome: { ...DEFAULT_METRONOME },
    weightKg: DEFAULT_WEIGHT_KG,
    crisis: { ...DEFAULT_CRISIS },
    settings: { ...DEFAULT_SETTINGS },
    savedAt: 0,
  };
}

export interface CodeStore extends PersistedSession {
  /** ticker-driven clock value; excluded from persistence */
  now: number;
  /** increments only on meaningful mutations (not on tick) — drives debounced saves */
  rev: number;
  /** true when a previous in-progress session was reloaded from disk */
  restored: boolean;

  tick: (now: number) => void;
  dismissRestored: () => void;

  startCode: () => void;
  pauseCode: () => void;
  resumeCode: () => void;
  resetCycle: (rhythm?: RhythmLoop) => void;
  declareRosc: () => void;
  terminateCode: () => void;
  reArrest: () => void;

  logEvent: (category: EventCategory, label: string, detail?: string) => void;
  administerEpi: () => void;
  deliverShock: (joules: number, shockable: boolean) => void;
  administerAmiodarone: () => void;
  markAirwayPlaced: () => void;
  toggleCause: (id: CauseId) => void;
  setWeight: (kg: number) => void;
  setMetronome: (patch: Partial<MetronomeState>) => void;
  setSetting: (patch: Partial<Settings>) => void;
  declareCrisis: (kind: 'last' | 'mh' | 'cico' | 'maternal') => void;
  logCrisisDose: (dose: { label: string; mg?: number; ml?: number; category?: EventCategory }) => void;
  reset: () => void;
}

function toPersisted(s: CodeStore): PersistedSession {
  return {
    version: 1,
    status: s.status,
    startedAt: s.startedAt,
    pausedAt: s.pausedAt,
    pausedAccumMs: s.pausedAccumMs,
    cycleStartedAt: s.cycleStartedAt,
    cyclePausedAccumMs: s.cyclePausedAccumMs,
    cycleIndex: s.cycleIndex,
    events: s.events,
    shocks: s.shocks,
    epi: s.epi,
    amio: s.amio,
    crisisDoses: s.crisisDoses,
    airwayPlaced: s.airwayPlaced,
    ventilationStarted: s.ventilationStarted,
    causes: s.causes,
    metronome: s.metronome,
    weightKg: s.weightKg,
    crisis: s.crisis,
    settings: s.settings,
    savedAt: Date.now(),
  };
}

const persisted = loadPersisted();
const bootSession: PersistedSession = persisted ?? emptySession();
const wasRestored = persisted != null && persisted.status !== 'idle' && persisted.events.length > 0;

export const useCodeStore = create<CodeStore>((set) => {
  /** Merge a mutation, bumping the persistence revision. */
  const apply = (fn: (s: CodeStore) => Partial<CodeStore>) => {
    set((s) => ({ ...fn(s), rev: s.rev + 1 }));
  };

  const el = (s: CodeStore, at: number) => masterElapsedMs(s, at);

  return {
    ...bootSession,
    now: Date.now(),
    rev: 0,
    restored: wasRestored,

    tick: (now) => set({ now }),
    dismissRestored: () => apply(() => ({ restored: false })),

    startCode: () =>
      apply((s) => {
        if (s.status !== 'idle') return {};
        const at = Date.now();
        return {
          status: 'active' as SessionStatus,
          startedAt: at,
          pausedAt: null,
          pausedAccumMs: 0,
          cycleStartedAt: at,
          cyclePausedAccumMs: 0,
          cycleIndex: 1,
          events: [
            ...s.events,
            mkEvent('system', 'Code Initiated', 'Cardiac arrest recognised — CPR started', at, 0),
            mkEvent('cpr', 'Chest Compressions Started', 'Target 100–120/min, depth 5–6 cm', at, 0),
          ],
        };
      }),

    pauseCode: () =>
      apply((s) => {
        if (s.status !== 'active') return {};
        const at = Date.now();
        return {
          status: 'paused' as SessionStatus,
          pausedAt: at,
          events: [...s.events, mkEvent('system', 'CPR Paused', undefined, at, el(s, at))],
        };
      }),

    resumeCode: () =>
      apply((s) => {
        if (s.status !== 'paused') return {};
        const at = Date.now();
        const delta = s.pausedAt != null ? at - s.pausedAt : 0;
        return {
          status: 'active' as SessionStatus,
          pausedAt: null,
          pausedAccumMs: s.pausedAccumMs + delta,
          cyclePausedAccumMs: s.cycleStartedAt != null ? s.cyclePausedAccumMs + delta : 0,
          events: [...s.events, mkEvent('system', 'CPR Resumed', undefined, at, el(s, at))],
        };
      }),

    resetCycle: (rhythm) =>
      apply((s) => {
        if (s.status !== 'active' && s.status !== 'paused') return {};
        const at = Date.now();
        const ref = s.pausedAt ?? at;
        const completed = s.cycleIndex;
        const events: CodeEvent[] = [...s.events];
        const t = el(s, at);
        events.push(
          mkEvent(
            'cycle',
            `Cycle ${completed} complete`,
            'Rhythm check / switch compressor',
            at,
            t,
          ),
        );
        if (rhythm) {
          events.push(mkEvent('rhythm', `Rhythm check — ${rhythm}`, undefined, at, t));
        }
        return {
          cycleStartedAt: ref,
          cyclePausedAccumMs: 0,
          cycleIndex: completed + 1,
          events,
        };
      }),

    declareRosc: () =>
      apply((s) => {
        if (s.status !== 'active' && s.status !== 'paused') return {};
        const at = Date.now();
        playChime();
        haptic.rosc();
        return {
          status: 'rosc' as SessionStatus,
          pausedAt: s.pausedAt ?? at,
          metronome: { ...s.metronome, on: false },
          events: [
            ...s.events,
            mkEvent('rosc', 'ROSC Achieved', 'Return of spontaneous circulation — begin post-arrest care', at, el(s, at)),
          ],
        };
      }),

    terminateCode: () =>
      apply((s) => {
        if (s.status === 'idle' || s.status === 'terminated') return {};
        const at = Date.now();
        playClose();
        return {
          status: 'terminated' as SessionStatus,
          pausedAt: s.pausedAt ?? at,
          metronome: { ...s.metronome, on: false },
          events: [...s.events, mkEvent('system', 'Code Terminated', 'Resuscitation ceased', at, el(s, at))],
        };
      }),

    reArrest: () =>
      apply((s) => {
        if (s.status !== 'rosc') return {};
        const at = Date.now();
        const delta = s.pausedAt != null ? at - s.pausedAt : 0;
        return {
          status: 'active' as SessionStatus,
          pausedAt: null,
          pausedAccumMs: s.pausedAccumMs + delta,
          cycleStartedAt: at,
          cyclePausedAccumMs: 0,
          cycleIndex: s.cycleIndex + 1,
          events: [...s.events, mkEvent('system', 'Re-arrest', 'CPR resumed', at, el(s, at))],
        };
      }),

    logEvent: (category, label, detail) =>
      apply((s) => {
        const at = Date.now();
        return { events: [...s.events, mkEvent(category, label, detail, at, el(s, at))] };
      }),

    administerEpi: () =>
      apply((s) => {
        const at = Date.now();
        const t = el(s, at);
        const dose: DoseEvent = { at, t, label: 'Epinephrine 1 mg IV/IO', mg: 1 };
        playConfirm();
        haptic.confirm();
        return {
          epi: [...s.epi, dose],
          events: [
            ...s.events,
            mkEvent('drug', 'Epinephrine 1 mg IV/IO', 'Repeat every 3–5 min', at, t),
          ],
        };
      }),

    deliverShock: (joules, shockable) =>
      apply((s) => {
        const at = Date.now();
        const t = el(s, at);
        const n = s.shocks.length + 1;
        const shock: ShockEvent = { at, t, joules, shockable };
        haptic.confirm();
        return {
          shocks: [...s.shocks, shock],
          events: [
            ...s.events,
            mkEvent(
              'shock',
              `Defibrillation ${joules} J`,
              `Shock #${n}${shockable ? '' : ' (unshockable rhythm)'}`,
              at,
              t,
            ),
          ],
        };
      }),

    administerAmiodarone: () =>
      apply((s) => {
        const at = Date.now();
        const t = el(s, at);
        const count = s.amio.length;
        const mg = count === 0 ? 300 : 150;
        const dose: DoseEvent = { at, t, label: `Amiodarone ${mg} mg IV/IO`, mg };
        playConfirm();
        haptic.confirm();
        return {
          amio: [...s.amio, dose],
          events: [
            ...s.events,
            mkEvent('drug', `Amiodarone ${mg} mg IV/IO`, count === 0 ? 'First dose' : count === 1 ? 'Second dose' : 'Additional dose', at, t),
          ],
        };
      }),

    markAirwayPlaced: () =>
      apply((s) => {
        if (s.airwayPlaced) return {};
        const at = Date.now();
        haptic.confirm();
        return {
          airwayPlaced: true,
          ventilationStarted: true,
          events: [
            ...s.events,
            mkEvent(
              'airway',
              'Advanced Airway Placed',
              'Continuous compressions + 1 breath every 6 s (10/min)',
              at,
              el(s, at),
            ),
          ],
        };
      }),

    toggleCause: (id) =>
      apply((s) => {
        const next = { ...s.causes, [id]: !s.causes[id] };
        if (!s.causes[id]) {
          const cause = CAUSES.find((c) => c.id === id);
          const at = Date.now();
          haptic.warn();
          return {
            causes: next,
            events: [
              ...s.events,
              mkEvent('cause', `Cause addressed — ${cause?.label ?? id}`, cause?.hint, at, el(s, at)),
            ],
          };
        }
        return { causes: next };
      }),

    setWeight: (kg) =>
      apply(() => {
        const clamped = Math.max(10, Math.min(250, Math.round(kg)));
        return { weightKg: clamped };
      }),

    setMetronome: (patch) => apply((s) => ({ metronome: { ...s.metronome, ...patch } })),

    setSetting: (patch) => apply((s) => ({ settings: { ...s.settings, ...patch } })),

    declareCrisis: (kind) =>
      apply((s) => {
        const at = Date.now();
        const t = el(s, at);
        const crisis = { ...s.crisis };
        let label = '';
        let detail = '';
        switch (kind) {
          case 'last':
            crisis.lastDeclaredAt = at;
            label = 'LAST Declared';
            detail = 'Local anesthetic systemic toxicity — start 20% lipid emulsion';
            break;
          case 'mh':
            crisis.mhDeclaredAt = at;
            label = 'Malignant Hyperthermia suspected';
            detail = 'Stop triggers, hyperventilate 100% O₂, give dantrolene';
            break;
          case 'cico':
            crisis.cicoDeclaredAt = at;
            label = 'CICO Declared';
            detail = 'Front-of-neck access (eFONA) — scalpel-bougie-tube';
            break;
          case 'maternal':
            crisis.maternalStartedAt = at;
            label = 'Maternal cardiac arrest';
            detail = '4-minute rule started — begin resuscitative hysterotomy by minute 4';
            break;
        }
        haptic.warn();
        return { crisis, events: [...s.events, mkEvent('crisis', label, detail, at, t)] };
      }),

    logCrisisDose: ({ label, mg, ml, category = 'crisis' }) =>
      apply((s) => {
        const at = Date.now();
        const t = el(s, at);
        const dose: DoseEvent = { at, t, label, mg, ml };
        playConfirm();
        haptic.confirm();
        const detail = [mg != null ? `${mg} mg` : null, ml != null ? `${ml} mL` : null]
          .filter(Boolean)
          .join(' · ');
        return {
          crisisDoses: [...s.crisisDoses, dose],
          events: [...s.events, mkEvent(category, label, detail || undefined, at, t)],
        };
      }),

    reset: () => {
      clearPersisted();
      set({ ...emptySession(), now: Date.now(), rev: 0, restored: false });
    },
  };
});

// --- Auto-save wiring ---------------------------------------------------------
// Persist only when the revision changes (i.e. a real mutation), never on tick.
const writer = createDebouncedWriter(400);
let lastRev = useCodeStore.getState().rev;

useCodeStore.subscribe((state) => {
  if (state.rev === lastRev) return;
  lastRev = state.rev;
  writer.save(toPersisted(state));
});

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => writer.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') writer.flush();
  });
}

/** True while any perioperative crisis clock has been started (drives the ticker and wake lock). */
export function hasCrisisClock(s: Pick<PersistedSession, 'crisis'>): boolean {
  const c = s.crisis;
  return (
    c.maternalStartedAt != null || c.cicoDeclaredAt != null || c.mhDeclaredAt != null || c.lastDeclaredAt != null
  );
}

/** Cycle length re-exported for UI convenience. */
export const CYCLE_LENGTH_MS = CYCLE_MS;
