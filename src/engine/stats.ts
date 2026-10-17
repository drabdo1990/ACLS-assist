/**
 * Per-code statistics — pure, derived from the existing session data (no extra tracking).
 * "From activation" times are wall-clock (event.at − startedAt), labelled "as logged".
 * Missing data is null, never a fake 0. Spec: docs/superpowers/specs/2026-10-16-stats-admin-i18n-design.md §4.2.
 */
import type { AirwayType, CauseId, PersistedSession, PocusId, RhythmBranch } from './types';
import type { Population, WeightSource } from '../content/profiles';
import { masterElapsedMs } from './timing';
import { isChecklistItemOn } from './checklist';
import {
  AIRWAY_EVENT_PREFIX,
  MAGNESIUM_NOT_CALCULATED_LABEL,
  MAGNESIUM_PREFIX,
  POST_ROSC_PREFIX,
  REARREST_LABEL,
  RHYTHM_CHECK_PREFIX,
  airwayTypeFromLabel,
  branchFromEvents,
} from './eventQueries';
import { CAUSES } from '../content/causes';
import { POCUS_ITEMS } from '../content/pocus';
import { POST_ROSC_BUNDLE } from '../content/protocols';
import { PEDIATRIC_POST_ROSC_BUNDLE } from '../content/profiles/pediatric';

export const STATS_VERSION = 2;
/** Upper bound of the guideline epinephrine interval ("every 3–5 min"). */
export const EPI_INTERVAL_FLAG_MS = 300_000;

export type Outcome = 'rosc' | 'rosc_then_terminated' | 'terminated' | 'incomplete';

export interface CodeStats {
  statsVersion: number;
  /** v2. Records from v1 read as adult. */
  population: Population;
  /** Dosing weight (pediatric: null until set). */
  weightKg: number | null;
  weightSource: WeightSource;
  /** Set when the weight was estimated from age (APLS), in months. */
  ageMonths: number | null;
  startedAt: number;
  endedAt: number | null;
  arrestMs: number;
  outcome: Outcome;
  roscCount: number;
  firstRoscMs: number | null;
  firstShockMs: number | null;
  firstEpiMs: number | null;
  branchAtFirstEpi: RhythmBranch | null;
  shocks: { count: number; joules: number[]; perKg: Array<number | null> };
  epi: {
    count: number;
    meanIntervalMs: number | null;
    longestIntervalMs: number | null;
    flagThresholdMs: number;
    longestExceedsThreshold: boolean;
    /** Doses logged with no calculable weight (pediatric). */
    notCalculated: number;
  };
  amiodarone: { count: number; totalMg: number; notCalculated: number };
  lidocaine: { count: number; notCalculated: number };
  magnesium: { count: number; notCalculated: number };
  cycles: number;
  pausedMs: number;
  airway: { type: AirwayType | null; firstPlacedMs: number | null };
  rhythms: string[];
  causes: CauseId[];
  pocus: PocusId[];
  postRosc: { done: number; total: number } | null;
}

/** The session fields statistics read (the store state and a PersistedSession both satisfy it). */
export type StatsInput = Pick<
  PersistedSession,
  | 'population'
  | 'weightKg'
  | 'weightSource'
  | 'ageMonths'
  | 'status'
  | 'startedAt'
  | 'endedAt'
  | 'roscAccumMs'
  | 'pausedAt'
  | 'pausedAccumMs'
  | 'events'
  | 'shocks'
  | 'epi'
  | 'amio'
  | 'lido'
  | 'causes'
  | 'pocus'
>;

const list = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

export function computeCodeStats(s: StatsInput, now: number): CodeStats | null {
  if (s.startedAt == null || s.status === 'idle') return null;
  const startedAt = s.startedAt;
  const since = (at: number) => Math.max(0, at - startedAt);

  const events = [...list(s.events)].sort((a, b) => a.at - b.at);
  const shocks = list(s.shocks);
  const epiTimes = list(s.epi)
    .map((d) => d.at)
    .sort((a, b) => a - b);
  const amio = list(s.amio);
  const lido = list(s.lido);

  const roscEvents = events.filter((e) => e.category === 'rosc');
  const roscCount = roscEvents.length;
  const outcome: Outcome =
    s.status === 'rosc'
      ? 'rosc'
      : s.status === 'terminated'
        ? roscCount > 0
          ? 'rosc_then_terminated'
          : 'terminated'
        : 'incomplete';

  // ROSC periods (ROSC → Re-arrest, or still open) are not arrest time: an epi interval that spans
  // one must not read as a delayed dose in the debrief.
  const roscPeriods: Array<[number, number]> = [];
  let roscOpen: number | null = null;
  for (const e of events) {
    if (e.category === 'rosc') roscOpen = e.at;
    else if (e.category === 'system' && e.label === REARREST_LABEL && roscOpen != null) {
      roscPeriods.push([roscOpen, e.at]);
      roscOpen = null;
    }
  }
  if (roscOpen != null) roscPeriods.push([roscOpen, Math.max(roscOpen, now)]);
  const roscOverlap = (a: number, b: number) =>
    roscPeriods.reduce((sum, [start, end]) => sum + Math.max(0, Math.min(b, end) - Math.max(a, start)), 0);
  const intervals = epiTimes.slice(1).map((t, i) => t - epiTimes[i] - roscOverlap(epiTimes[i], t));
  const longest = intervals.length ? Math.max(...intervals) : null;
  const firstEpiAt = epiTimes.length ? epiTimes[0] : null;
  const airwayEvent = events.find((e) => e.category === 'airway' && e.label.startsWith(AIRWAY_EVENT_PREFIX));
  const endedAt = s.endedAt ?? null;

  return {
    statsVersion: STATS_VERSION,
    population: s.population ?? 'adult',
    weightKg: s.weightKg ?? null,
    weightSource: s.weightSource ?? null,
    ageMonths: s.ageMonths ?? null,
    startedAt,
    endedAt,
    arrestMs: masterElapsedMs({ startedAt, endedAt, roscAccumMs: s.roscAccumMs ?? 0 }, now),
    outcome,
    roscCount,
    firstRoscMs: roscEvents.length ? since(roscEvents[0].at) : null,
    firstShockMs: shocks.length ? since(Math.min(...shocks.map((x) => x.at))) : null,
    firstEpiMs: firstEpiAt != null ? since(firstEpiAt) : null,
    branchAtFirstEpi: firstEpiAt != null ? branchFromEvents(events.filter((e) => e.at <= firstEpiAt)) : null,
    shocks: {
      count: shocks.length,
      joules: shocks.map((x) => x.joules),
      perKg: shocks.map((x) => x.perKg ?? null),
    },
    epi: {
      count: epiTimes.length,
      meanIntervalMs: intervals.length ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : null,
      longestIntervalMs: longest,
      flagThresholdMs: EPI_INTERVAL_FLAG_MS,
      longestExceedsThreshold: longest != null && longest > EPI_INTERVAL_FLAG_MS,
      notCalculated: list(s.epi).filter((d) => d.mg == null).length,
    },
    amiodarone: {
      count: amio.length,
      totalMg: amio.reduce((a, d) => a + (d.mg ?? 0), 0),
      notCalculated: amio.filter((d) => d.mg == null).length,
    },
    lidocaine: { count: lido.length, notCalculated: lido.filter((d) => d.mg == null).length },
    magnesium: {
      count: events.filter((e) => e.category === 'drug' && e.label.startsWith(MAGNESIUM_PREFIX)).length,
      notCalculated: events.filter((e) => e.category === 'drug' && e.label === MAGNESIUM_NOT_CALCULATED_LABEL).length,
    },
    cycles: events.filter((e) => e.category === 'cycle').length,
    pausedMs:
      (s.pausedAccumMs ?? 0) + (s.status === 'paused' && s.pausedAt != null ? Math.max(0, now - s.pausedAt) : 0),
    airway: {
      type: airwayEvent ? airwayTypeFromLabel(airwayEvent.label) : null,
      firstPlacedMs: airwayEvent ? since(airwayEvent.at) : null,
    },
    rhythms: events
      .filter((e) => e.category === 'rhythm' && e.label.startsWith(RHYTHM_CHECK_PREFIX))
      .map((e) => e.label.slice(RHYTHM_CHECK_PREFIX.length)),
    causes: CAUSES.filter((c) => s.causes?.[c.id]).map((c) => c.id),
    pocus: POCUS_ITEMS.filter((p) => s.pocus?.[p.id]).map((p) => p.id),
    postRosc: (() => {
      if (roscCount === 0) return null;
      const bundle = (s.population ?? 'adult') === 'pediatric' ? PEDIATRIC_POST_ROSC_BUNDLE : POST_ROSC_BUNDLE;
      return {
        done: bundle.filter((i) => isChecklistItemOn(events, POST_ROSC_PREFIX, i.text)).length,
        total: bundle.length,
      };
    })(),
  };
}
