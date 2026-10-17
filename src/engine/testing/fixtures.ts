import { emptySession } from '../persistence';
import { EPI_INTERVAL_FLAG_MS, STATS_VERSION, type CodeStats } from '../stats';
import type { CodeRecord } from '../history';
import type { PersistedSession } from '../types';

export const T0 = 1_700_000_000_000;
export const DEVICE = 'a1b2c3d4e5f6';

export function mkStats(o: Partial<CodeStats> = {}): CodeStats {
  const startedAt = o.startedAt ?? T0;
  return {
    statsVersion: STATS_VERSION,
    population: 'adult',
    weightKg: null,
    weightSource: null,
    ageMonths: null,
    startedAt,
    endedAt: startedAt + 600_000,
    arrestMs: 600_000,
    outcome: 'rosc',
    roscCount: 1,
    firstRoscMs: 600_000,
    firstShockMs: 90_000,
    firstEpiMs: 120_000,
    branchAtFirstEpi: 'shockable',
    shocks: { count: 2, joules: [200, 200], perKg: [null, null] },
    epi: { count: 3, meanIntervalMs: 200_000, longestIntervalMs: 240_000, flagThresholdMs: EPI_INTERVAL_FLAG_MS, longestExceedsThreshold: false, notCalculated: 0 },
    amiodarone: { count: 1, totalMg: 300, notCalculated: 0 },
    lidocaine: { count: 0, notCalculated: 0 },
    magnesium: { count: 0, notCalculated: 0 },
    cycles: 4,
    pausedMs: 20_000,
    airway: { type: 'ETT', firstPlacedMs: 300_000 },
    rhythms: ['VF', 'VF', 'PEA'],
    causes: ['hypoxia'],
    pocus: [],
    postRosc: { done: 2, total: 6 },
    ...o,
  };
}

/** The n-th record of a device: one hour apart, deterministic ids. */
export function mkRecord(n = 0, o: Partial<CodeRecord> = {}, so: Partial<CodeStats> = {}): CodeRecord {
  const startedAt = T0 + n * 3_600_000;
  const stats = mkStats({ startedAt, ...so });
  return {
    id: `${startedAt}-${DEVICE}`,
    deviceId: DEVICE,
    startedAt,
    unit: null,
    stats,
    training: false,
    voided: false,
    uploadStatus: 'local',
    savedAt: startedAt,
    ...o,
  };
}

/** A finished (terminated) 2-minute code with one shock — enough to be recorded. */
export function endedSession(o: Partial<PersistedSession> = {}): PersistedSession {
  return {
    ...emptySession(),
    status: 'terminated',
    startedAt: T0,
    endedAt: T0 + 120_000,
    pausedAt: T0 + 120_000,
    events: [
      { id: 'e1', at: T0, t: 0, category: 'system', label: 'Code Blue activated' },
      { id: 'e2', at: T0 + 60_000, t: 60_000, category: 'shock', label: 'Defibrillation: Shock #1 (200J Biphasic)' },
      { id: 'e3', at: T0 + 120_000, t: 120_000, category: 'system', label: 'Code ended' },
    ],
    shocks: [{ at: T0 + 60_000, t: 60_000, joules: 200, shockable: true }],
    ...o,
  };
}
