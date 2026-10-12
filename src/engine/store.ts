import { create } from 'zustand';
import type {
  AirwayType,
  Antiarrhythmic,
  CauseId,
  CodeEvent,
  DoseEvent,
  EventCategory,
  MetronomeState,
  PersistedSession,
  PocusId,
  RhythmBranch,
  RhythmLoop,
  SessionStatus,
  Settings,
  ShockEvent,
} from './types';
import { CYCLE_MS, formatDuration, masterElapsedMs } from './timing';
import { clockNow } from './clock';
import { clearPersisted, createDebouncedWriter, emptySession, loadPersisted } from './persistence';
import { playChime, playClose, playConfirm } from './audio';
import { haptic } from './haptics';
import { CAUSES } from '../content/causes';
import { POCUS_ITEMS } from '../content/pocus';
import {
  EPINEPHRINE,
  MAGNESIUM,
  amiodaroneDoseMg,
  lidocaineBudget,
  lidocaineDose,
  waveformFor,
  waveformLabel,
} from '../content/calc';

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

const BRANCH_LABEL: Record<RhythmBranch, string> = {
  shockable: 'Shockable (VF / pVT)',
  nonshockable: 'Non-shockable (Asystole / PEA)',
};
const BRANCH_EVENT_PREFIX = 'Rhythm branch: ';
const AIRWAY_EVENT_PREFIX = 'Advanced airway placed';
const AIRWAY_LABEL: Record<AirwayType, string> = { ETT: 'ETT', SGA: 'Supraglottic airway' };

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
  setRhythmBranch: (branch: RhythmBranch) => void;
  administerEpi: () => void;
  deliverShock: (joules: number) => void;
  setAntiarrhythmic: (drug: Antiarrhythmic) => void;
  administerAntiarrhythmic: () => void;
  administerAmiodarone: () => void;
  administerLidocaine: () => void;
  administerMagnesium: () => void;
  markAirwayPlaced: (type?: AirwayType) => void;
  toggleCause: (id: CauseId) => void;
  togglePocus: (id: PocusId) => void;
  setWeight: (kg: number) => void;
  setMetronome: (patch: Partial<MetronomeState>) => void;
  setSetting: (patch: Partial<Settings>) => void;
  undoLastEvent: () => void;
  reset: () => void;
}

function toPersisted(s: CodeStore): PersistedSession {
  return {
    version: 2,
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
    lido: s.lido,
    rhythmBranch: s.rhythmBranch,
    antiarrhythmic: s.antiarrhythmic,
    airwayPlaced: s.airwayPlaced,
    airwayType: s.airwayType,
    causes: s.causes,
    pocus: s.pocus,
    metronome: s.metronome,
    weightKg: s.weightKg,
    settings: s.settings,
    savedAt: Date.now(),
  };
}

/** Total epinephrine in mg. */
export function totalEpiMg(epi: DoseEvent[]): number {
  return Math.round(epi.reduce((sum, d) => sum + (d.mg ?? 0), 0) * 100) / 100;
}

/** Branch implied by the most recent branch event (used to roll back on undo). */
function branchFromEvents(events: CodeEvent[]): RhythmBranch | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.category === 'rhythm' && e.label.startsWith(BRANCH_EVENT_PREFIX)) {
      return e.label.includes('Non-shockable') ? 'nonshockable' : 'shockable';
    }
  }
  return null;
}

const persisted = loadPersisted();
const bootSession: PersistedSession = persisted ?? emptySession();
const wasRestored = persisted != null && (persisted.status !== 'idle' || persisted.events.length > 0);

export const useCodeStore = create<CodeStore>((set, get) => {
  /** Merge a mutation, bumping the persistence revision. */
  const apply = (fn: (s: CodeStore) => Partial<CodeStore>) => {
    set((s) => ({ ...fn(s), rev: s.rev + 1 }));
  };

  const el = (s: CodeStore, at: number) => masterElapsedMs(s, at);

  return {
    ...bootSession,
    now: clockNow(),
    rev: 0,
    restored: wasRestored,

    tick: (now) => set({ now }),
    dismissRestored: () => apply(() => ({ restored: false })),

    startCode: () =>
      apply((s) => {
        if (s.status !== 'idle') return {};
        const at = clockNow();
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
            mkEvent('system', 'Code Blue activated', 'Cardiac arrest recognised — CPR started', at, 0),
            mkEvent('cpr', 'Chest compressions started', 'Rate 100–120/min, depth 5–6 cm, full recoil', at, 0),
          ],
        };
      }),

    pauseCode: () =>
      apply((s) => {
        if (s.status !== 'active') return {};
        const at = clockNow();
        return {
          status: 'paused' as SessionStatus,
          pausedAt: at,
          events: [...s.events, mkEvent('system', 'CPR paused', undefined, at, el(s, at))],
        };
      }),

    resumeCode: () =>
      apply((s) => {
        if (s.status !== 'paused') return {};
        const at = clockNow();
        const delta = s.pausedAt != null ? at - s.pausedAt : 0;
        return {
          status: 'active' as SessionStatus,
          pausedAt: null,
          pausedAccumMs: s.pausedAccumMs + delta,
          cyclePausedAccumMs: s.cycleStartedAt != null ? s.cyclePausedAccumMs + delta : 0,
          events: [...s.events, mkEvent('system', 'CPR resumed', undefined, at, el(s, at))],
        };
      }),

    resetCycle: (rhythm) =>
      apply((s) => {
        if (s.status !== 'active' && s.status !== 'paused') return {};
        const at = clockNow();
        const ref = s.pausedAt ?? at;
        const completed = s.cycleIndex;
        const t = el(s, at);
        const events: CodeEvent[] = [
          ...s.events,
          mkEvent(
            'cycle',
            `Cycle ${completed} completed`,
            rhythm ? `Rhythm: ${rhythm} · switch compressors` : 'Rhythm check / switch compressors',
            at,
            t,
          ),
        ];
        if (rhythm) events.push(mkEvent('rhythm', `Rhythm check — ${rhythm}`, undefined, at, t));
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
        const at = clockNow();
        const t = el(s, at);
        playChime();
        haptic.rosc();
        return {
          status: 'rosc' as SessionStatus,
          pausedAt: s.pausedAt ?? at,
          metronome: { ...s.metronome, on: false },
          events: [
            ...s.events,
            mkEvent(
              'rosc',
              'ROSC declared',
              `Total arrest duration: ${formatDuration(t)}. Total shocks: ${s.shocks.length}. Total epi: ${totalEpiMg(s.epi)} mg.`,
              at,
              t,
            ),
          ],
        };
      }),

    terminateCode: () =>
      apply((s) => {
        if (s.status === 'idle' || s.status === 'terminated') return {};
        const at = clockNow();
        const t = el(s, at);
        playClose();
        return {
          status: 'terminated' as SessionStatus,
          pausedAt: s.pausedAt ?? at,
          metronome: { ...s.metronome, on: false },
          events: [
            ...s.events,
            mkEvent('system', 'Code ended', `Resuscitation ceased · total duration ${formatDuration(t)}`, at, t),
          ],
        };
      }),

    reArrest: () =>
      apply((s) => {
        if (s.status !== 'rosc') return {};
        const at = clockNow();
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
        const at = clockNow();
        return { events: [...s.events, mkEvent(category, label, detail, at, el(s, at))] };
      }),

    setRhythmBranch: (branch) =>
      apply((s) => {
        if (s.rhythmBranch === branch) return {};
        const at = clockNow();
        haptic.confirm();
        return {
          rhythmBranch: branch,
          events: [
            ...s.events,
            mkEvent('rhythm', `${BRANCH_EVENT_PREFIX}${BRANCH_LABEL[branch]}`, undefined, at, el(s, at)),
          ],
        };
      }),

    administerEpi: () =>
      apply((s) => {
        const at = clockNow();
        const t = el(s, at);
        const n = s.epi.length + 1;
        const label = 'Epinephrine 1 mg IV/IO';
        playConfirm();
        haptic.confirm();
        return {
          epi: [...s.epi, { at, t, label, mg: 1 }],
          events: [
            ...s.events,
            mkEvent('drug', label, `Dose #${n} · ${EPINEPHRINE.flush} · repeat every 3–5 min`, at, t),
          ],
        };
      }),

    deliverShock: (joules) =>
      apply((s) => {
        const at = clockNow();
        const t = el(s, at);
        const n = s.shocks.length + 1;
        const waveform = waveformFor(joules);
        const shockable = s.rhythmBranch !== 'nonshockable';
        const shock: ShockEvent = { at, t, joules, shockable, waveform };
        haptic.confirm();
        return {
          shocks: [...s.shocks, shock],
          events: [
            ...s.events,
            mkEvent(
              'shock',
              `Defibrillation: Shock #${n} (${joules}J ${waveformLabel(waveform)})`,
              shockable ? undefined : 'Logged while on non-shockable branch',
              at,
              t,
            ),
          ],
        };
      }),

    setAntiarrhythmic: (drug) => apply(() => ({ antiarrhythmic: drug })),

    administerAntiarrhythmic: () => {
      if (get().antiarrhythmic === 'lidocaine') get().administerLidocaine();
      else get().administerAmiodarone();
    },

    administerAmiodarone: () =>
      apply((s) => {
        const at = clockNow();
        const t = el(s, at);
        const count = s.amio.length;
        const mg = amiodaroneDoseMg(count);
        const label = `Amiodarone ${mg} mg IV/IO`;
        playConfirm();
        haptic.confirm();
        return {
          amio: [...s.amio, { at, t, label, mg }],
          events: [
            ...s.events,
            mkEvent('drug', label, count === 0 ? 'First dose' : count === 1 ? 'Second dose' : 'Additional dose', at, t),
          ],
        };
      }),

    administerLidocaine: () =>
      apply((s) => {
        const at = clockNow();
        const t = el(s, at);
        const d = lidocaineDose(s.weightKg, s.lido.length);
        const budget = lidocaineBudget(s.weightKg, s.lido.map((x) => x.mg ?? 0));
        const label = `Lidocaine ${d.minMg}–${d.maxMg} mg IV/IO`;
        const cumulative = `cumulative ≥ ${budget.givenMg + d.minMg} of max ${budget.maxMg} mg (3 mg/kg)`;
        playConfirm();
        haptic.confirm();
        return {
          lido: [...s.lido, { at, t, label, mg: d.minMg }],
          events: [
            ...s.events,
            mkEvent(
              'drug',
              label,
              `Dose #${d.doseNo} · ${d.perKgLabel} (${s.weightKg} kg) · ${cumulative}${
                budget.nextExceeds ? ' · EXCEEDS 3 mg/kg' : ''
              }`,
              at,
              t,
            ),
          ],
        };
      }),

    administerMagnesium: () =>
      apply((s) => {
        const at = clockNow();
        playConfirm();
        haptic.confirm();
        return {
          events: [...s.events, mkEvent('drug', MAGNESIUM.label, MAGNESIUM.indication, at, el(s, at))],
        };
      }),

    markAirwayPlaced: (type = 'ETT') =>
      apply((s) => {
        const at = clockNow();
        haptic.confirm();
        if (s.airwayPlaced) {
          return {
            airwayPlaced: false,
            airwayType: null,
            events: [
              ...s.events,
              mkEvent('airway', 'Advanced airway unmarked', 'Returned to 30:2 compression-ventilation', at, el(s, at)),
            ],
          };
        }
        return {
          airwayPlaced: true,
          airwayType: type,
          events: [
            ...s.events,
            mkEvent(
              'airway',
              `${AIRWAY_EVENT_PREFIX} — ${AIRWAY_LABEL[type]}`,
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
        if (s.causes[id]) return { causes: next };
        const cause = CAUSES.find((c) => c.id === id);
        const at = clockNow();
        haptic.warn();
        return {
          causes: next,
          events: [
            ...s.events,
            mkEvent('cause', `Cause addressed — ${cause?.label ?? id}`, cause?.action, at, el(s, at)),
          ],
        };
      }),

    togglePocus: (id) =>
      apply((s) => {
        const next = { ...s.pocus, [id]: !s.pocus[id] };
        if (s.pocus[id]) return { pocus: next };
        const item = POCUS_ITEMS.find((p) => p.id === id);
        const at = clockNow();
        haptic.confirm();
        return {
          pocus: next,
          events: [...s.events, mkEvent('pocus', `POCUS — ${item?.label ?? id}`, item?.meaning, at, el(s, at))],
        };
      }),

    setWeight: (kg) =>
      apply(() => {
        const clamped = Math.max(30, Math.min(250, Math.round(kg)));
        return { weightKg: clamped };
      }),

    setMetronome: (patch) => apply((s) => ({ metronome: { ...s.metronome, ...patch } })),

    setSetting: (patch) => apply((s) => ({ settings: { ...s.settings, ...patch } })),

    undoLastEvent: () =>
      apply((s) => {
        if (s.events.length === 0) return {};
        const last = s.events[s.events.length - 1];
        // Lifecycle events (start, pause, ROSC, end) are never quick-undone.
        if (last.category === 'system' || last.category === 'cpr' || last.category === 'rosc') return {};
        const events = s.events.slice(0, -1);
        const isDrug = (prefix: string) => last.category === 'drug' && last.label.startsWith(prefix);
        const patch: Partial<CodeStore> = { events };

        if (isDrug('Epinephrine') && s.epi.length) patch.epi = s.epi.slice(0, -1);
        if (isDrug('Amiodarone') && s.amio.length) patch.amio = s.amio.slice(0, -1);
        if (isDrug('Lidocaine') && s.lido.length) patch.lido = s.lido.slice(0, -1);
        if (last.category === 'shock' && s.shocks.length) patch.shocks = s.shocks.slice(0, -1);

        if (last.category === 'airway') {
          // Undoing a placement un-places it; undoing an un-mark restores it.
          const placed = !last.label.startsWith(AIRWAY_EVENT_PREFIX);
          patch.airwayPlaced = placed;
          patch.airwayType = placed ? (s.airwayType ?? 'ETT') : null;
        }
        if (last.category === 'rhythm' && last.label.startsWith(BRANCH_EVENT_PREFIX)) {
          patch.rhythmBranch = branchFromEvents(events);
        }
        if (last.category === 'cause') {
          const cause = CAUSES.find((c) => last.label.endsWith(c.label));
          if (cause) patch.causes = { ...s.causes, [cause.id]: false };
        }
        if (last.category === 'pocus') {
          const item = POCUS_ITEMS.find((p) => last.label.endsWith(p.label));
          if (item) patch.pocus = { ...s.pocus, [item.id]: false };
        }
        return patch;
      }),

    reset: () => {
      clearPersisted();
      set({ ...emptySession(), now: clockNow(), rev: 0, restored: false });
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

/** Cycle length re-exported for UI convenience. */
export const CYCLE_LENGTH_MS = CYCLE_MS;
