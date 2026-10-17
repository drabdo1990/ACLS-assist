import { create } from 'zustand';
import type {
  AirwayType,
  Antiarrhythmic,
  CauseId,
  CodeEvent,
  DoseEvent,
  EventCategory,
  EventI18n,
  MetronomeState,
  PersistedSession,
  PocusId,
  RhythmBranch,
  RhythmLoop,
  SessionStatus,
  Settings,
  ShockEvent,
  WaveformType,
} from './types';
import { CYCLE_MS, masterElapsedMs } from './timing';
import { clockNow } from './clock';
import {
  clearPersisted,
  createDebouncedWriter,
  DEFAULT_WEIGHT_KG,
  emptySession,
  isStaleSession,
  loadPersisted,
} from './persistence';
import {
  AIRWAY_EVENT_PREFIX,
  BRANCH_EVENT_PREFIX,
  RHYTHM_CHECK_PREFIX,
  airwayFromEvents,
  branchFromEvents,
} from './eventQueries';
import { playChime, playClose, playConfirm } from './audio';
import { haptic } from './haptics';
import { CAUSES } from '../content/causes';
import { POCUS_ITEMS } from '../content/pocus';
import {
  amiodaroneDoseMg,
  lidocaineBudget,
  lidocaineDose,
  waveformFor,
} from '../content/calc';
import { keyed } from '../i18n/enText';
import type { KeyedEvent } from '../i18n/enText';
import type { MessageKey } from '../i18n/en';
import { profileFor } from '../content/profiles';
import type { Population, WeightSource } from '../content/profiles';

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
  i18n?: EventI18n,
): CodeEvent {
  const e: CodeEvent = { id: uid(), at, t, category, label, detail };
  if (i18n?.key) e.key = i18n.key;
  if (i18n?.params) e.params = i18n.params;
  if (i18n?.detailKey) e.detailKey = i18n.detailKey;
  if (i18n?.detailParams) e.detailParams = i18n.detailParams;
  return e;
}

/** Age wording: months under 1 year, otherwise fractional years ("age 2.5 y"). */
function ageEventParams(ageMonths: number): { key: 'estimatedMonths' | 'estimated'; params: Record<string, number> } {
  if (ageMonths < 12) return { key: 'estimatedMonths', params: { months: ageMonths } };
  return { key: 'estimated', params: { years: Math.round((ageMonths / 12) * 10) / 10 } };
}

/** The pediatric weight event label for a set/corrected weight (canonical English + key). */
function weightEvent(corrected: boolean, kg: number, source: WeightSource, ageMonths: number | null): KeyedEvent {
  if (source === 'measured') {
    return keyed(corrected ? 'ev.weight.corrected.measured' : 'ev.weight.set.measured', { kg });
  }
  const age = ageEventParams(ageMonths ?? 0);
  const base = corrected ? 'ev.weight.corrected.' : 'ev.weight.set.';
  return keyed((`${base}${age.key}`) as MessageKey, { kg, ...age.params });
}

/** The population event logged as the first event of a pediatric code (null for adult). */
function populationStartEvent(
  weightKg: number | null,
  weightSource: WeightSource,
  ageMonths: number | null,
): KeyedEvent | null {
  if (weightKg == null) return keyed('ev.pedsStart.noWeight');
  if (weightSource === 'estimated') {
    const age = ageEventParams(ageMonths ?? 0);
    return keyed((`ev.pedsStart.${age.key}`) as MessageKey, { kg: weightKg, ...age.params });
  }
  return keyed('ev.pedsStart.measured', { kg: weightKg });
}

export interface CodeStore extends PersistedSession {
  /** ticker-driven clock value; excluded from persistence */
  now: number;
  /** increments only on meaningful mutations (not on tick) — drives debounced saves */
  rev: number;
  /** true when a previous in-progress session was reloaded from disk */
  restored: boolean;
  /** age (ms) of a restored session that looks like a previous code; null when not stale */
  staleAgeMs: number | null;

  tick: (now: number) => void;
  dismissRestored: () => void;

  startCode: () => void;
  pauseCode: () => void;
  resumeCode: () => void;
  resetCycle: (rhythm?: RhythmLoop) => void;
  declareRosc: () => void;
  terminateCode: () => void;
  reArrest: () => void;

  logEvent: (category: EventCategory, label: string, detail?: string, i18n?: EventI18n) => void;
  /** Idle only: the Adult / Pediatric toggle. Locked by startCode. */
  setPopulation: (p: Population) => void;
  /** Pediatric weight entry — before the code (no event) or during one (logged). */
  setPediatricWeight: (kg: number, source: WeightSource, ageMonths?: number | null) => void;
  setRhythmBranch: (branch: RhythmBranch) => void;
  administerEpi: () => void;
  deliverShock: (joules: number, perKg?: number | null, waveform?: WaveformType) => void;
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
  setTraining: (on: boolean) => void;
  setVoided: (on: boolean) => void;
  undoLastEvent: () => void;
  reset: () => void;
}

function toPersisted(s: CodeStore): PersistedSession {
  return {
    version: 4,
    population: s.population,
    status: s.status,
    startedAt: s.startedAt,
    pausedAt: s.pausedAt,
    pausedAccumMs: s.pausedAccumMs,
    endedAt: s.endedAt,
    roscAccumMs: s.roscAccumMs,
    training: s.training,
    voided: s.voided,
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
    weightSource: s.weightSource,
    ageMonths: s.ageMonths,
    settings: s.settings,
    savedAt: Date.now(),
  };
}

/** Total epinephrine in mg. */
export function totalEpiMg(epi: DoseEvent[]): number {
  return Math.round(epi.reduce((sum, d) => sum + (d.mg ?? 0), 0) * 100) / 100;
}

const CAUSE_UNCHECK_PREFIX = 'Cause unchecked — ';
const POCUS_UNCHECK_PREFIX = 'POCUS unchecked — ';

/** Branch a logged rhythm check implies; `Pulse` implies none. */
const RHYTHM_BRANCH: Record<RhythmLoop, RhythmBranch | null> = {
  VF: 'shockable',
  pVT: 'shockable',
  PEA: 'nonshockable',
  Asystole: 'nonshockable',
  Pulse: null,
};

/**
 * Lifecycle and time-based events are never quick-undone: undo cannot restore the
 * cycle timer or the arrest clock, so a partial undo would leave log and state disagreeing.
 */
export function isUndoable(e: CodeEvent): boolean {
  if (e.category === 'system' || e.category === 'cpr' || e.category === 'rosc' || e.category === 'cycle') return false;
  if (e.category === 'rhythm' && e.label.startsWith(RHYTHM_CHECK_PREFIX)) return false;
  return true;
}

/**
 * Length of the open CPR pause at `at`, never negative: a backward wall-clock step larger than
 * the pause would otherwise drive the accumulators below zero, which `sanitizeSession` rejects
 * (quarantining the live code at the next boot).
 */
function pauseDelta(pausedAt: number | null, at: number): number {
  return pausedAt != null ? Math.max(0, at - pausedAt) : 0;
}

/** A repeat of the same dose/shock this soon is a gloved double-tap, not a second administration. */
const REPEAT_TAP_MS = 1500;
function isRepeatTap(lastAt: number | undefined, at: number): boolean {
  // A negative gap (clock stepped back) is not a repeat.
  return lastAt != null && at - lastAt >= 0 && at - lastAt < REPEAT_TAP_MS;
}

const persisted = loadPersisted();
const bootSession: PersistedSession = persisted ?? emptySession();
const wasRestored = persisted != null && (persisted.status !== 'idle' || persisted.events.length > 0);
const bootStaleAgeMs =
  persisted != null && wasRestored && isStaleSession(persisted, Date.now()) ? Date.now() - persisted.savedAt : null;

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
    staleAgeMs: bootStaleAgeMs,

    tick: (now) => set({ now }),
    dismissRestored: () => apply(() => ({ restored: false, staleAgeMs: null })),

    startCode: () =>
      apply((s) => {
        if (s.status !== 'idle') return {};
        const at = clockNow();
        const ev1 = keyed('ev.start', undefined, 'ev.start.detail');
        const ev2 = keyed('ev.compressions', undefined, 'ev.compressions.detail');
        const events: CodeEvent[] = [...s.events];
        // The population event opens the pediatric audit trail; adult keeps today's two events.
        if (s.population === 'pediatric') {
          const pop = populationStartEvent(s.weightKg, s.weightSource, s.ageMonths);
          if (pop) events.push(mkEvent('system', pop.label, pop.detail, at, 0, pop.i18n));
        }
        events.push(mkEvent('system', ev1.label, ev1.detail, at, 0, ev1.i18n));
        events.push(mkEvent('cpr', ev2.label, ev2.detail, at, 0, ev2.i18n));
        return {
          status: 'active' as SessionStatus,
          startedAt: at,
          pausedAt: null,
          pausedAccumMs: 0,
          endedAt: null,
          roscAccumMs: 0,
          cycleStartedAt: at,
          cyclePausedAccumMs: 0,
          cycleIndex: 1,
          events,
        };
      }),

    pauseCode: () =>
      apply((s) => {
        if (s.status !== 'active') return {};
        const at = clockNow();
        const ev = keyed('ev.pause');
        return {
          status: 'paused' as SessionStatus,
          pausedAt: at,
          events: [...s.events, mkEvent('system', ev.label, undefined, at, el(s, at), ev.i18n)],
        };
      }),

    resumeCode: () =>
      apply((s) => {
        if (s.status !== 'paused') return {};
        const at = clockNow();
        const delta = pauseDelta(s.pausedAt, at);
        const ev = keyed('ev.resume');
        return {
          status: 'active' as SessionStatus,
          pausedAt: null,
          pausedAccumMs: s.pausedAccumMs + delta,
          cyclePausedAccumMs: s.cycleStartedAt != null ? s.cyclePausedAccumMs + delta : 0,
          events: [...s.events, mkEvent('system', ev.label, undefined, at, el(s, at), ev.i18n)],
        };
      }),

    resetCycle: (rhythm) =>
      apply((s) => {
        if (s.status !== 'active' && s.status !== 'paused') return {};
        const at = clockNow();
        const ref = s.pausedAt ?? at;
        const completed = s.cycleIndex;
        const t = el(s, at);
        const cycleEv = keyed(
          'ev.cycle',
          { n: completed },
          rhythm ? 'ev.cycle.detailRhythm' : 'ev.cycle.detail',
          rhythm ? { rhythm: `@rhythm.${rhythm}` } : undefined,
        );
        const events: CodeEvent[] = [
          ...s.events,
          mkEvent('cycle', cycleEv.label, cycleEv.detail, at, t, cycleEv.i18n),
        ];
        if (rhythm) {
          const rEv = keyed('ev.rhythmCheck', { rhythm: `@rhythm.${rhythm}` });
          events.push(mkEvent('rhythm', rEv.label, undefined, at, t, rEv.i18n));
        }
        // Keep the algorithm branch in step with the rhythm just logged. The branch event is
        // appended last so a mis-tapped rhythm can be corrected with Undo.
        const branch = rhythm ? RHYTHM_BRANCH[rhythm] : null;
        const branchPatch: Partial<CodeStore> = {};
        if (branch && branch !== s.rhythmBranch) {
          const bEv = keyed('ev.branch', { branch: `@branch.${branch}` });
          events.push(mkEvent('rhythm', bEv.label, undefined, at, t, bEv.i18n));
          branchPatch.rhythmBranch = branch;
        }
        return {
          cycleStartedAt: ref,
          cyclePausedAccumMs: 0,
          cycleIndex: completed + 1,
          events,
          ...branchPatch,
        };
      }),

    declareRosc: () =>
      apply((s) => {
        if (s.status !== 'active' && s.status !== 'paused') return {};
        const at = clockNow();
        const t = el(s, at);
        playChime();
        haptic.rosc();
        const closesPause = s.status === 'paused' && s.pausedAt != null;
        const roscEv = keyed('ev.rosc', undefined, 'ev.rosc.detail', {
          durationMs: t,
          shocks: s.shocks.length,
          epiMg: totalEpiMg(s.epi),
        });
        return {
          status: 'rosc' as SessionStatus,
          endedAt: at,
          pausedAt: s.pausedAt ?? at, // freezes the 2-min cycle
          pausedAccumMs: closesPause ? s.pausedAccumMs + pauseDelta(s.pausedAt, at) : s.pausedAccumMs,
          metronome: { ...s.metronome, on: false },
          events: [
            ...s.events,
            mkEvent('rosc', roscEv.label, roscEv.detail, at, t, roscEv.i18n),
          ],
        };
      }),

    terminateCode: () =>
      apply((s) => {
        if (s.status === 'idle' || s.status === 'terminated') return {};
        const at = clockNow();
        const t = el(s, at);
        playClose();
        const closesPause = s.status === 'paused' && s.pausedAt != null;
        const endEv = keyed('ev.end', undefined, 'ev.end.detail', { durationMs: t });
        return {
          status: 'terminated' as SessionStatus,
          endedAt: s.status === 'rosc' ? s.endedAt : at,
          pausedAt: s.pausedAt ?? at,
          pausedAccumMs: closesPause ? s.pausedAccumMs + pauseDelta(s.pausedAt, at) : s.pausedAccumMs,
          metronome: { ...s.metronome, on: false },
          events: [
            ...s.events,
            mkEvent('system', endEv.label, endEv.detail, at, t, endEv.i18n),
          ],
        };
      }),

    reArrest: () =>
      apply((s) => {
        if (s.status !== 'rosc') return {};
        const at = clockNow();
        const roscDelta = s.endedAt != null ? Math.max(0, at - s.endedAt) : 0;
        const reEv = keyed('ev.rearrest', undefined, 'ev.resume');
        return {
          status: 'active' as SessionStatus,
          pausedAt: null,
          endedAt: null,
          roscAccumMs: s.roscAccumMs + roscDelta,
          cycleStartedAt: at,
          cyclePausedAccumMs: 0,
          cycleIndex: s.cycleIndex + 1,
          events: [...s.events, mkEvent('system', reEv.label, reEv.detail, at, el(s, at), reEv.i18n)],
        };
      }),

    logEvent: (category, label, detail, i18n) =>
      apply((s) => {
        const at = clockNow();
        return { events: [...s.events, mkEvent(category, label, detail, at, el(s, at), i18n)] };
      }),

    setPopulation: (p) =>
      apply((s) => {
        if (s.status !== 'idle' || s.population === p) return {};
        return {
          population: p,
          // Switching population resets the weight: adult falls back to the 70 kg default,
          // pediatric starts with "Set weight".
          weightKg: p === 'pediatric' ? null : DEFAULT_WEIGHT_KG,
          weightSource: null,
          ageMonths: null,
        };
      }),

    setPediatricWeight: (kg, source, ageMonths = null) =>
      apply((s) => {
        if (s.population !== 'pediatric' || s.status === 'terminated') return {};
        if (!Number.isFinite(kg) || kg < 0.5 || kg > 150) return {};
        const kgR = Math.round(kg * 10) / 10;
        const age =
          source === 'estimated' && ageMonths != null && Number.isInteger(ageMonths) && ageMonths >= 0 && ageMonths <= 216
            ? ageMonths
            : null;
        if (s.status === 'idle') {
          return { weightKg: kgR, weightSource: source, ageMonths: age };
        }
        const corrected = s.events.some(
          (e) => e.label.startsWith('Weight set — ') || e.label.startsWith('Weight corrected — '),
        );
        const ev = weightEvent(corrected, kgR, source, age);
        const at = clockNow();
        return {
          weightKg: kgR,
          weightSource: source,
          ageMonths: age,
          events: [...s.events, mkEvent('system', ev.label, ev.detail, at, el(s, at), ev.i18n)],
        };
      }),

    setRhythmBranch: (branch) =>
      apply((s) => {
        if (s.rhythmBranch === branch) return {};
        const at = clockNow();
        haptic.confirm();
        const bEv = keyed('ev.branch', { branch: `@branch.${branch}` });
        return {
          rhythmBranch: branch,
          events: [
            ...s.events,
            mkEvent('rhythm', bEv.label, undefined, at, el(s, at), bEv.i18n),
          ],
        };
      }),

    administerEpi: () => {
      if (isRepeatTap(get().epi.at(-1)?.at, clockNow())) return;
      apply((s) => {
        const at = clockNow();
        const t = el(s, at);
        const n = s.epi.length + 1;
        playConfirm();
        haptic.confirm();
        if (s.population === 'pediatric') {
          const dose = profileFor('pediatric').epinephrine(s.weightKg, n - 1);
          const epiEv = dose
            ? keyed('ev.pedsEpi', { mg: dose.mg }, 'ev.pedsEpi.detail', { n, kg: s.weightKg ?? 0 })
            : keyed('ev.pedsEpi.noWeight', undefined, 'ev.pedsEpi.noWeight.detail', { n });
          return {
            epi: [...s.epi, { at, t, label: epiEv.label, mg: dose ? dose.mg : null }],
            events: [
              ...s.events,
              mkEvent('drug', epiEv.label, epiEv.detail, at, t, epiEv.i18n),
            ],
          };
        }
        const label = 'Epinephrine 1 mg IV/IO';
        const epiEv = keyed('ev.epi', undefined, 'ev.epi.detail', { n });
        return {
          epi: [...s.epi, { at, t, label, mg: 1 }],
          events: [
            ...s.events,
            mkEvent('drug', epiEv.label, epiEv.detail, at, t, epiEv.i18n),
          ],
        };
      });
    },

    deliverShock: (joules, perKg, waveformOverride) => {
      if (isRepeatTap(get().shocks.at(-1)?.at, clockNow())) return;
      apply((s) => {
        const at = clockNow();
        const t = el(s, at);
        const n = s.shocks.length + 1;
        const waveform = waveformOverride ?? waveformFor(joules);
        const shockable = s.rhythmBranch !== 'nonshockable';
        const shock: ShockEvent = { at, t, joules, shockable, waveform, ...(perKg != null ? { perKg } : {}) };
        haptic.confirm();
        const shockEv = keyed(
          'ev.shock',
          { n, joules, waveform: `@waveform.${waveform}` },
          shockable ? undefined : 'ev.shock.nonshockable',
        );
        return {
          shocks: [...s.shocks, shock],
          events: [
            ...s.events,
            mkEvent('shock', shockEv.label, shockEv.detail, at, t, shockEv.i18n),
          ],
        };
      });
    },

    setAntiarrhythmic: (drug) => apply(() => ({ antiarrhythmic: drug })),

    administerAntiarrhythmic: () => {
      if (get().antiarrhythmic === 'lidocaine') get().administerLidocaine();
      else get().administerAmiodarone();
    },

    administerAmiodarone: () => {
      if (isRepeatTap(get().amio.at(-1)?.at, clockNow())) return;
      apply((s) => {
        const at = clockNow();
        const t = el(s, at);
        const count = s.amio.length;
        playConfirm();
        haptic.confirm();
        if (s.population === 'pediatric') {
          const dose = profileFor('pediatric').amiodarone(s.weightKg, count);
          if (!dose) {
            const offEv = keyed('ev.pedsAmio.noWeight');
            return {
              amio: [...s.amio, { at, t, label: offEv.label, mg: null }],
              events: [...s.events, mkEvent('drug', offEv.label, undefined, at, t, offEv.i18n)],
            };
          }
          const detailKey: MessageKey = count === 0 ? 'ev.dose.first' : count === 1 ? 'ev.dose.second' : 'ev.dose.additional';
          const amioEv = keyed('ev.amio', { mg: dose.mg }, detailKey);
          return {
            amio: [...s.amio, { at, t, label: amioEv.label, mg: dose.mg }],
            events: [
              ...s.events,
              mkEvent('drug', amioEv.label, amioEv.detail, at, t, amioEv.i18n),
            ],
          };
        }
        const mg = amiodaroneDoseMg(count);
        const label = `Amiodarone ${mg} mg IV/IO`;
        const detailKey: MessageKey = count === 0 ? 'ev.dose.first' : count === 1 ? 'ev.dose.second' : 'ev.dose.additional';
        const amioEv = keyed('ev.amio', { mg }, detailKey);
        return {
          amio: [...s.amio, { at, t, label, mg }],
          events: [
            ...s.events,
            mkEvent('drug', amioEv.label, amioEv.detail, at, t, amioEv.i18n),
          ],
        };
      });
    },

    administerLidocaine: () => {
      if (isRepeatTap(get().lido.at(-1)?.at, clockNow())) return;
      apply((s) => {
        const at = clockNow();
        const t = el(s, at);
        playConfirm();
        haptic.confirm();
        if (s.population === 'pediatric') {
          const dose = profileFor('pediatric').lidocaine(s.weightKg, s.lido.length);
          if (!dose) {
            const offEv = keyed('ev.pedsLido.noWeight');
            return {
              lido: [...s.lido, { at, t, label: offEv.label, mg: null }],
              events: [...s.events, mkEvent('drug', offEv.label, undefined, at, t, offEv.i18n)],
            };
          }
          const lidoEv = keyed('ev.pedsLido', { mg: dose.mg }, 'ev.pedsLido.detail', {
            n: s.lido.length + 1,
            kg: s.weightKg ?? 0,
          });
          return {
            lido: [...s.lido, { at, t, label: lidoEv.label, mg: dose.mg }],
            events: [
              ...s.events,
              mkEvent('drug', lidoEv.label, lidoEv.detail, at, t, lidoEv.i18n),
            ],
          };
        }
        const kg = s.weightKg ?? DEFAULT_WEIGHT_KG;
        const d = lidocaineDose(kg, s.lido.length);
        const budget = lidocaineBudget(kg, s.lido.map((x) => x.mg ?? 0));
        const label = `Lidocaine ${d.minMg}–${d.maxMg} mg IV/IO`;
        const detailKey: MessageKey = budget.nextExceeds ? 'ev.lido.detailExceeds' : 'ev.lido.detail';
        const lidoEv = keyed(
          'ev.lido',
          { minMg: d.minMg, maxMg: d.maxMg },
          detailKey,
          {
            n: d.doseNo,
            perKg: d.perKgLabel,
            kg,
            cumMg: budget.givenMg + d.minMg,
            maxMg: budget.maxMg,
          },
        );
        return {
          lido: [...s.lido, { at, t, label, mg: d.minMg }],
          events: [
            ...s.events,
            mkEvent('drug', lidoEv.label, lidoEv.detail, at, t, lidoEv.i18n),
          ],
        };
      });
    },

    administerMagnesium: () => {
      // Magnesium keeps no dose list, so compare with the last logged event.
      const last = get().events.at(-1);
      if (last?.category === 'drug' && last.label.startsWith('Magnesium') && isRepeatTap(last.at, clockNow())) return;
      apply((s) => {
        const at = clockNow();
        playConfirm();
        haptic.confirm();
        if (s.population === 'pediatric') {
          const dose = profileFor('pediatric').magnesium(s.weightKg);
          const magEv = dose
            ? keyed('ev.pedsMag', { minMg: dose.minMg, maxMg: dose.maxMg })
            : keyed('ev.pedsMag.noWeight');
          return {
            events: [...s.events, mkEvent('drug', magEv.label, magEv.detail, at, el(s, at), magEv.i18n)],
          };
        }
        const magEv = keyed('ev.mag', undefined, 'ev.mag.detail');
        return {
          events: [...s.events, mkEvent('drug', magEv.label, magEv.detail, at, el(s, at), magEv.i18n)],
        };
      });
    },

    markAirwayPlaced: (type = 'ETT') =>
      apply((s) => {
        const at = clockNow();
        haptic.confirm();
        if (s.airwayPlaced) {
          const offEv = keyed('ev.airwayOff', undefined, 'ev.airwayOff.detail');
          return {
            airwayPlaced: false,
            airwayType: null,
            events: [
              ...s.events,
              mkEvent('airway', offEv.label, offEv.detail, at, el(s, at), offEv.i18n),
            ],
          };
        }
        const onEv = keyed('ev.airway', { airway: `@airway.${type}` }, 'ev.airway.detail');
        return {
          airwayPlaced: true,
          airwayType: type,
          events: [
            ...s.events,
            mkEvent('airway', onEv.label, onEv.detail, at, el(s, at), onEv.i18n),
          ],
        };
      }),

    toggleCause: (id) =>
      apply((s) => {
        const next = { ...s.causes, [id]: !s.causes[id] };
        const at = clockNow();
        if (s.causes[id]) {
          // Unticking is recorded, not erased, so the timeline stays an honest audit trail.
          const offEv = keyed('ev.causeOff', { cause: `@cause.${id}.label` });
          return {
            causes: next,
            events: [...s.events, mkEvent('cause', offEv.label, undefined, at, el(s, at), offEv.i18n)],
          };
        }
        haptic.warn();
        const onEv = keyed('ev.causeOn', { cause: `@cause.${id}.label` }, `cause.${id}.action`);
        return {
          causes: next,
          events: [
            ...s.events,
            mkEvent('cause', onEv.label, onEv.detail, at, el(s, at), onEv.i18n),
          ],
        };
      }),

    togglePocus: (id) =>
      apply((s) => {
        const next = { ...s.pocus, [id]: !s.pocus[id] };
        const at = clockNow();
        if (s.pocus[id]) {
          const offEv = keyed('ev.pocusOff', { item: `@pocus.${id}.label` });
          return {
            pocus: next,
            events: [...s.events, mkEvent('pocus', offEv.label, undefined, at, el(s, at), offEv.i18n)],
          };
        }
        haptic.confirm();
        const onEv = keyed('ev.pocusOn', { item: `@pocus.${id}.label` }, `pocus.${id}.meaning`);
        return {
          pocus: next,
          events: [...s.events, mkEvent('pocus', onEv.label, onEv.detail, at, el(s, at), onEv.i18n)],
        };
      }),

    setWeight: (kg) =>
      apply((s) => {
        // Adult-only slider; pediatric weight goes through setPediatricWeight.
        if (s.population === 'pediatric') return {};
        const clamped = Math.max(30, Math.min(250, Math.round(kg)));
        return { weightKg: clamped };
      }),

    setMetronome: (patch) => apply((s) => ({ metronome: { ...s.metronome, ...patch } })),

    setSetting: (patch) => apply((s) => ({ settings: { ...s.settings, ...patch } })),

    setTraining: (on) => apply(() => ({ training: on })),
    setVoided: (on) => apply(() => ({ voided: on })),

    undoLastEvent: () =>
      apply((s) => {
        if (s.events.length === 0) return {};
        const last = s.events[s.events.length - 1];
        // Lifecycle and cycle/rhythm-check events are never quick-undone (see isUndoable).
        if (!isUndoable(last)) return {};
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
          patch.airwayType = placed ? airwayFromEvents(events) : null;
        }
        if (last.category === 'rhythm' && last.label.startsWith(BRANCH_EVENT_PREFIX)) {
          patch.rhythmBranch = branchFromEvents(events);
        }
        if (last.category === 'cause') {
          // Undoing a check un-checks it; undoing an un-check restores it.
          const wasUncheck = last.label.startsWith(CAUSE_UNCHECK_PREFIX);
          const cause = CAUSES.find((c) => last.label.endsWith(c.label));
          if (cause) patch.causes = { ...s.causes, [cause.id]: wasUncheck };
        }
        if (last.category === 'pocus') {
          const wasUncheck = last.label.startsWith(POCUS_UNCHECK_PREFIX);
          const item = POCUS_ITEMS.find((p) => last.label.endsWith(p.label));
          if (item) patch.pocus = { ...s.pocus, [item.id]: wasUncheck };
        }
        return patch;
      }),

    reset: () => {
      clearPersisted();
      // New code: the population choice survives (it is a device-level choice); the weight
      // resets per population (adult default 70, pediatric "Set weight").
      set((s) => {
        const peds = s.population === 'pediatric';
        return {
          ...emptySession(),
          population: s.population,
          weightKg: peds ? null : DEFAULT_WEIGHT_KG,
          now: clockNow(),
          rev: 0,
          restored: false,
          staleAgeMs: null,
        };
      });
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
