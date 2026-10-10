/**
 * CodeOR domain types.
 * PHI-free by construction: no fields exist for patient identity, MRN, or demographics.
 * Weight is a protocol input only and is not linked to any identifier.
 */

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
  | 'crisis'
  | 'rosc'
  | 'post';

export interface CodeEvent {
  id: string;
  /** Absolute epoch ms — the source of truth, survives refresh/pause. */
  at: number;
  /** Elapsed ms since code start at the moment of logging (stable for display). */
  t: number;
  category: EventCategory;
  label: string;
  detail?: string;
}

export type RhythmLoop = 'VF' | 'pVT' | 'PEA' | 'Asystole' | 'Pulse';

export interface ShockEvent {
  at: number;
  t: number;
  joules: number;
  /** true when the shock was delivered for a shockable rhythm (VF/pVT). */
  shockable: boolean;
}

export interface DoseEvent {
  at: number;
  t: number;
  label: string;
  mg?: number;
  ml?: number;
}

export type CauseId =
  | 'hypoxia'
  | 'hypovolemia'
  | 'hypo_hyperkalemia'
  | 'hypothermia'
  | 'tension_ptx'
  | 'tamponade'
  | 'toxins'
  | 'thrombosis';

export interface MetronomeState {
  on: boolean;
  audio: boolean;
  haptic: boolean;
  bpm: number;
}

export interface CrisisTimers {
  /** epoch ms when the perinatal code clock was started (maternal 4-min rule). */
  maternalStartedAt: number | null;
  /** epoch ms when CICO was declared. */
  cicoDeclaredAt: number | null;
  /** epoch ms when MH was suspected/declared. */
  mhDeclaredAt: number | null;
  /** epoch ms when LAST was suspected/declared. */
  lastDeclaredAt: number | null;
}

export interface Settings {
  /** Epinephrine re-dose lockout window in ms (AHA 3–5 min). Default 3:00. */
  epiLockoutMs: number;
  /** Default shock energy in J. */
  defaultJoules: number;
}

/** The serializable slice persisted to localStorage. */
export interface PersistedSession {
  version: 1;
  status: SessionStatus;
  startedAt: number | null;
  pausedAt: number | null;
  pausedAccumMs: number;
  cycleStartedAt: number | null;
  cyclePausedAccumMs: number;
  cycleIndex: number;
  events: CodeEvent[];
  shocks: ShockEvent[];
  epi: DoseEvent[];
  amio: DoseEvent[];
  /** Crisis-calculator doses (lipid, dantrolene, sugammadex, ...) — persists across refresh. */
  crisisDoses: DoseEvent[];
  airwayPlaced: boolean;
  ventilationStarted: boolean;
  causes: Partial<Record<CauseId, boolean>>;
  metronome: MetronomeState;
  weightKg: number;
  crisis: CrisisTimers;
  settings: Settings;
  /** epoch ms of the most recent "heartbeat" write, for stale-session detection. */
  savedAt: number;
}
