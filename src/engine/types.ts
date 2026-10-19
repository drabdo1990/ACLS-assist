/**
 * ResusCode domain types.
 * PHI-free by construction: no fields exist for patient identity, MRN, or demographics.
 * Weight is a dosing input only (weight-based adult lidocaine; every pediatric dose) and is
 * not linked to any identifier.
 */

import type { Population, WeightSource } from '../content/profiles';

export type SessionStatus = 'idle' | 'active' | 'paused' | 'rosc' | 'terminated';

export type EventCategory =
  | 'system'
  | 'cycle'
  | 'cpr'
  | 'airway'
  | 'drug'
  | 'shock'
  | 'rhythm'
  | 'cause'
  | 'pocus'
  | 'rosc'
  | 'post';

/** Raw display params: numbers, ids as `@message.key`, durations in `*Ms` — never English fragments. */
export type EventParams = Record<string, string | number>;

/** Translation keys stored next to the canonical English text (display only; logic never reads them). */
export interface EventI18n {
  key?: string;
  params?: EventParams;
  detailKey?: string;
  detailParams?: EventParams;
}

export interface CodeEvent extends EventI18n {
  id: string;
  /** Absolute epoch ms — the source of truth, survives refresh/pause. */
  at: number;
  /** Elapsed ms since code start at the moment of logging (stable for display). */
  t: number;
  category: EventCategory;
  /** Canonical English — part of the audit trail; all logic matches on it. */
  label: string;
  detail?: string;
}

export type RhythmLoop = 'VF' | 'pVT' | 'PEA' | 'Asystole' | 'Pulse';

/** AHA/ERC algorithm branch selected by the team leader. */
export type RhythmBranch = 'shockable' | 'nonshockable';

export type Antiarrhythmic = 'amiodarone' | 'lidocaine';

export type AirwayType = 'ETT' | 'SGA';

export type WaveformType = 'biphasic' | 'monophasic';

export interface ShockEvent {
  at: number;
  t: number;
  joules: number;
  /** true when the shock was delivered for a shockable rhythm (VF/pVT). */
  shockable: boolean;
  waveform?: WaveformType;
  /** J/kg actually applied (pediatric weight-based shocks); null / absent for adult. */
  perKg?: number | null;
}

export interface DoseEvent {
  at: number;
  t: number;
  label: string;
  /** Logged mg, or null when the dose was logged without a calculable weight (pediatric). */
  mg?: number | null;
}

export type CauseId =
  | 'hypovolemia'
  | 'hypoxia'
  | 'hydrogen_ion'
  | 'hypo_hyperkalemia'
  | 'hypothermia'
  | 'hypoglycemia'
  | 'tension_ptx'
  | 'tamponade'
  | 'toxins'
  | 'thrombosis_pulmonary'
  | 'thrombosis_coronary';

export type PocusId = 'effusion' | 'rv_strain' | 'contractility' | 'standstill' | 'lung_sliding';

export interface MetronomeState {
  on: boolean;
  audio: boolean;
  haptic: boolean;
  bpm: number;
}

export interface Settings {
  /** Epinephrine re-dose interval in ms (AHA 3–5 min). Default 3:00. */
  epiLockoutMs: number;
  /** Default shock energy in J. */
  defaultJoules: number;
}

/** The serializable slice persisted to localStorage. */
export interface PersistedSession {
  version: 4;
  /** Locked at startCode — a mis-pick is fixed by ending the code and starting a new one. */
  population: Population;
  status: SessionStatus;
  startedAt: number | null;
  pausedAt: number | null;
  /** Total CPR-pause time (v3). Drives the 2-min cycle and "time logged as paused"; NOT subtracted from arrest time. */
  pausedAccumMs: number;
  /** Master clock freeze point: set at ROSC and termination, cleared on re-arrest. */
  endedAt: number | null;
  /** Sum of closed ROSC intervals — the only time excluded from arrest time. */
  roscAccumMs: number;
  /** Training / simulation code (excluded from statistics aggregates). */
  training: boolean;
  /** Voided: kept, but excluded from statistics. */
  voided: boolean;
  cycleStartedAt: number | null;
  cyclePausedAccumMs: number;
  cycleIndex: number;
  events: CodeEvent[];
  shocks: ShockEvent[];
  epi: DoseEvent[];
  amio: DoseEvent[];
  lido: DoseEvent[];
  rhythmBranch: RhythmBranch | null;
  antiarrhythmic: Antiarrhythmic;
  airwayPlaced: boolean;
  airwayType: AirwayType | null;
  causes: Partial<Record<CauseId, boolean>>;
  pocus: Partial<Record<PocusId, boolean>>;
  metronome: MetronomeState;
  /**
   * Dosing weight in kg. Adult: 70 default (lidocaine range), slider 30–250.
   * Pediatric: null until set (doses read "Set weight"); valid range 0.5–150.
   */
  weightKg: number | null;
  /** How the pediatric weight was obtained (null for adult / not yet set). */
  weightSource: WeightSource;
  /** Set when the weight was estimated from age (APLS), in months. */
  ageMonths: number | null;
  settings: Settings;
  /** epoch ms of the most recent write, for stale-session detection. */
  savedAt: number;
}
