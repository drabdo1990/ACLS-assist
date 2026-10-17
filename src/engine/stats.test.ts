import { describe, it, expect } from 'vitest';
import { EPI_INTERVAL_FLAG_MS, computeCodeStats, type StatsInput } from './stats';
import { emptySession } from './persistence';
import type { CodeEvent } from './types';

const T0 = 1_700_000_000_000;
const ev = (ms: number, category: CodeEvent['category'], label: string): CodeEvent => ({
  id: `${ms}-${label}`,
  at: T0 + ms,
  t: ms,
  category,
  label,
});
const dose = (ms: number, label = 'Epinephrine 1 mg IV/IO', mg = 1) => ({ at: T0 + ms, t: ms, label, mg });
const started = (patch: Partial<StatsInput> = {}): StatsInput => ({
  ...emptySession(),
  status: 'active',
  startedAt: T0,
  events: [ev(0, 'system', 'Code Blue activated')],
  ...patch,
});

describe('computeCodeStats', () => {
  it('returns null for a code that never started', () => {
    expect(computeCodeStats(emptySession(), T0)).toBeNull();
  });

  it('classifies each outcome', () => {
    const rosc = [ev(100_000, 'rosc', 'ROSC declared')];
    expect(
      computeCodeStats(started({ status: 'rosc', endedAt: T0 + 100_000, pausedAt: T0 + 100_000, events: rosc }), T0)!
        .outcome,
    ).toBe('rosc');
    expect(
      computeCodeStats(
        started({ status: 'terminated', endedAt: T0 + 100_000, pausedAt: T0 + 100_000, events: rosc }),
        T0,
      )!.outcome,
    ).toBe('rosc_then_terminated');
    expect(
      computeCodeStats(started({ status: 'terminated', endedAt: T0 + 90_000, pausedAt: T0 + 90_000 }), T0)!.outcome,
    ).toBe('terminated');
    expect(computeCodeStats(started(), T0 + 5_000)!.outcome).toBe('incomplete');
  });

  it('measures first shock / first epi from activation in wall-clock time', () => {
    const st = computeCodeStats(
      started({
        shocks: [{ at: T0 + 45_000, t: 45_000, joules: 200, shockable: true }],
        epi: [dose(100_000)],
        events: [
          ev(0, 'system', 'Code Blue activated'),
          ev(10_000, 'rhythm', 'Rhythm branch: Non-shockable (Asystole / PEA)'),
        ],
      }),
      T0 + 200_000,
    )!;
    expect(st.firstShockMs).toBe(45_000);
    expect(st.firstEpiMs).toBe(100_000);
    expect(st.branchAtFirstEpi).toBe('nonshockable');
    expect(st.shocks).toEqual({ count: 1, joules: [200], perKg: [null] });
  });

  it('reports "no data" as null, never as 0', () => {
    const st = computeCodeStats(started(), T0 + 60_000)!;
    expect(st.firstShockMs).toBeNull();
    expect(st.firstEpiMs).toBeNull();
    expect(st.branchAtFirstEpi).toBeNull();
    expect(st.epi.meanIntervalMs).toBeNull();
    expect(st.epi.longestIntervalMs).toBeNull();
    expect(st.airway).toEqual({ type: null, firstPlacedMs: null });
    expect(st.postRosc).toBeNull();
  });

  it('computes epinephrine intervals and flags only intervals over 5:00', () => {
    const flagged = computeCodeStats(started({ epi: [dose(0), dose(180_000), dose(600_000)] }), T0 + 700_000)!;
    expect(flagged.epi.meanIntervalMs).toBe(300_000);
    expect(flagged.epi.longestIntervalMs).toBe(420_000);
    expect(flagged.epi.longestExceedsThreshold).toBe(true);
    expect(flagged.epi.flagThresholdMs).toBe(EPI_INTERVAL_FLAG_MS);
    const ok = computeCodeStats(started({ epi: [dose(0), dose(300_000)] }), T0 + 400_000)!;
    expect(ok.epi.longestExceedsThreshold).toBe(false);
  });

  it('includes an open CPR pause in pausedMs', () => {
    const st = computeCodeStats(
      started({ status: 'paused', pausedAt: T0 + 60_000, pausedAccumMs: 10_000 }),
      T0 + 90_000,
    )!;
    expect(st.pausedMs).toBe(40_000);
    expect(st.arrestMs).toBe(90_000);
  });

  it('reads airway, rhythms, magnesium, cycles, causes, POCUS and Post-ROSC completion', () => {
    const st = computeCodeStats(
      started({
        status: 'rosc',
        endedAt: T0 + 400_000,
        pausedAt: T0 + 400_000,
        causes: { hypoxia: true, toxins: false },
        pocus: { effusion: true },
        events: [
          ev(0, 'system', 'Code Blue activated'),
          ev(120_000, 'cycle', 'Cycle 1 completed'),
          ev(120_000, 'rhythm', 'Rhythm check — VF'),
          ev(150_000, 'airway', 'Advanced airway placed — Supraglottic airway'),
          ev(200_000, 'drug', 'Magnesium sulfate 1–2 g IV/IO'),
          ev(400_000, 'rosc', 'ROSC declared'),
          ev(410_000, 'post', 'Post-ROSC: 12-lead ECG — STEMI → Cath Lab; decides ICU vs CCU'),
        ],
      }),
      T0 + 500_000,
    )!;
    expect(st.airway).toEqual({ type: 'SGA', firstPlacedMs: 150_000 });
    expect(st.rhythms).toEqual(['VF']);
    expect(st.magnesium.count).toBe(1);
    expect(st.cycles).toBe(1);
    expect(st.causes).toEqual(['hypoxia']);
    expect(st.pocus).toEqual(['effusion']);
    expect(st.postRosc).toEqual({ done: 1, total: 8 });
    expect(st.firstRoscMs).toBe(400_000);
    expect(st.arrestMs).toBe(400_000);
  });

  it('never throws on legacy data with missing arrays', () => {
    const legacy = { ...started(), events: undefined, shocks: undefined, epi: undefined } as unknown as StatsInput;
    expect(() => computeCodeStats(legacy, T0 + 1000)).not.toThrow();
    expect(computeCodeStats(legacy, T0 + 1000)!.shocks.count).toBe(0);
  });
});

describe('epinephrine intervals across ROSC (review fix)', () => {
  it('excludes time spent in ROSC from the interval between doses', () => {
    const st = computeCodeStats(
      started({
        epi: [dose(0), dose(2_400_000)],
        roscAccumMs: 1_800_000,
        events: [
          ev(0, 'system', 'Code Blue activated'),
          ev(600_000, 'rosc', 'ROSC declared'),
          ev(2_400_000, 'system', 'Re-arrest'),
        ],
      }),
      T0 + 2_500_000,
    )!;
    expect(st.epi.longestIntervalMs).toBe(600_000);
    expect(st.epi.meanIntervalMs).toBe(600_000);
  });

  it('works on a v1-migrated session (spec §4.2)', async () => {
    const { migrateV1 } = await import('./persistence');
    const m = migrateV1({
      version: 1, status: 'active', startedAt: T0, pausedAt: null, pausedAccumMs: 0, cycleStartedAt: T0,
      cyclePausedAccumMs: 0, cycleIndex: 1,
      events: [{ id: 'a', at: T0, t: 0, category: 'system', label: 'Code Initiated' }],
      shocks: [{ at: T0 + 45_000, t: 45_000, joules: 200, shockable: true }],
      epi: [{ at: T0 + 70_000, t: 70_000, label: 'Epinephrine 1 mg IV/IO', mg: 1 }],
    })!;
    const st = computeCodeStats(m, T0 + 100_000)!;
    expect(st.firstShockMs).toBe(45_000);
    expect(st.firstEpiMs).toBe(70_000);
    expect(st.outcome).toBe('incomplete');
    expect(st.arrestMs).toBe(100_000);
  });
});
