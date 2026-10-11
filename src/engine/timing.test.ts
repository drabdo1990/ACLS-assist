import { describe, it, expect } from 'vitest';
import {
  CYCLE_MS,
  masterElapsedMs,
  cycleElapsedMs,
  cycleRemainingMs,
  cyclePhase,
  cycleProgress,
  formatClock,
  formatWallClock,
  epiLockoutRemainingMs,
  epiLockoutLabel,
} from './timing';

const T0 = 1_000_000_000_000;

describe('masterElapsedMs', () => {
  it('is zero before the code starts', () => {
    expect(masterElapsedMs({ startedAt: null, pausedAt: null, pausedAccumMs: 0 }, T0)).toBe(0);
  });

  it('counts wall time while running', () => {
    const s = { startedAt: T0, pausedAt: null, pausedAccumMs: 0 };
    expect(masterElapsedMs(s, T0 + 90_000)).toBe(90_000);
  });

  it('freezes while paused and does not advance with `now`', () => {
    const s = { startedAt: T0, pausedAt: T0 + 30_000, pausedAccumMs: 0 };
    expect(masterElapsedMs(s, T0 + 30_000)).toBe(30_000);
    // still 30s no matter how much wall time passes while paused
    expect(masterElapsedMs(s, T0 + 500_000)).toBe(30_000);
  });

  it('subtracts accumulated pause duration after resume', () => {
    // ran 30s, paused for 20s, then resumed
    const s = { startedAt: T0, pausedAt: null, pausedAccumMs: 20_000 };
    expect(masterElapsedMs(s, T0 + 80_000)).toBe(60_000);
  });

  it('never goes negative', () => {
    const s = { startedAt: T0, pausedAt: null, pausedAccumMs: 1e12 };
    expect(masterElapsedMs(s, T0)).toBe(0);
  });
});

describe('cycleElapsedMs / cycleRemainingMs', () => {
  const base = { startedAt: T0, pausedAt: null, pausedAccumMs: 0, cyclePausedAccumMs: 0 };

  it('treats a fresh, unstarted cycle as fully elapsed', () => {
    expect(cycleElapsedMs({ ...base, cycleStartedAt: null }, T0)).toBe(CYCLE_MS);
    expect(cycleRemainingMs({ ...base, cycleStartedAt: null }, T0)).toBe(0);
  });

  it('counts down inside the cycle', () => {
    const s = { ...base, cycleStartedAt: T0 };
    expect(cycleRemainingMs(s, T0 + 45_000)).toBe(CYCLE_MS - 45_000);
  });

  it('clamps elapsed at the cycle length (never overruns negative remaining)', () => {
    const s = { ...base, cycleStartedAt: T0 };
    expect(cycleElapsedMs(s, T0 + 10 * CYCLE_MS)).toBe(CYCLE_MS);
    expect(cycleRemainingMs(s, T0 + 10 * CYCLE_MS)).toBe(0);
  });

  it('is independent of the master clock after a mid-cycle reset', () => {
    // master started long ago, cycle restarted 5s ago
    const s = {
      startedAt: T0,
      pausedAt: null,
      pausedAccumMs: 0,
      cycleStartedAt: T0 + 600_000,
      cyclePausedAccumMs: 0,
    };
    expect(masterElapsedMs(s, T0 + 605_000)).toBe(605_000);
    expect(cycleRemainingMs(s, T0 + 605_000)).toBe(CYCLE_MS - 5_000);
  });

  it('freezes the cycle while paused', () => {
    const s = {
      startedAt: T0,
      pausedAt: T0 + 40_000,
      pausedAccumMs: 0,
      cycleStartedAt: T0,
      cyclePausedAccumMs: 0,
    };
    expect(cycleRemainingMs(s, T0 + 40_000)).toBe(CYCLE_MS - 40_000);
    expect(cycleRemainingMs(s, T0 + 999_999)).toBe(CYCLE_MS - 40_000);
  });
});

describe('cyclePhase', () => {
  it('maps remaining time to cruise/warn/crit', () => {
    expect(cyclePhase(120_000)).toBe('cruise');
    expect(cyclePhase(30_001)).toBe('cruise');
    expect(cyclePhase(30_000)).toBe('warn');
    expect(cyclePhase(10_001)).toBe('warn');
    expect(cyclePhase(10_000)).toBe('crit');
    expect(cyclePhase(0)).toBe('crit');
  });
});

describe('cycleProgress', () => {
  it('is 0 at the start and 1 at expiry', () => {
    expect(cycleProgress(CYCLE_MS)).toBe(0);
    expect(cycleProgress(60_000)).toBe(0.5);
    expect(cycleProgress(0)).toBe(1);
  });
});

describe('formatClock', () => {
  it('formats MM:SS with zero padding', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(5_000)).toBe('00:05');
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(600_000)).toBe('10:00');
  });

  it('promotes to H:MM:SS past an hour', () => {
    expect(formatClock(3_600_000)).toBe('1:00:00');
    expect(formatClock(3_661_000)).toBe('1:01:01');
  });

  it('clamps negative input to 00:00', () => {
    expect(formatClock(-5000)).toBe('00:00');
  });
});

describe('formatWallClock', () => {
  it('renders local HH:MM:SS with zero padding', () => {
    const d = new Date(2024, 0, 2, 3, 4, 5);
    expect(formatWallClock(d.getTime())).toBe('03:04:05');
  });
});

describe('epinephrine lockout', () => {
  it('is eligible when there is no prior dose', () => {
    expect(epiLockoutRemainingMs(null, 180_000, T0)).toBe(0);
    expect(epiLockoutLabel(undefined, 180_000, T0)).toBeNull();
  });

  it('counts down a 3:00 window', () => {
    expect(epiLockoutRemainingMs(T0, 180_000, T0 + 60_000)).toBe(120_000);
    expect(epiLockoutLabel(T0, 180_000, T0 + 60_000)).toBe('02:00');
  });

  it('reads eligible exactly at expiry', () => {
    expect(epiLockoutRemainingMs(T0, 180_000, T0 + 180_000)).toBe(0);
    expect(epiLockoutLabel(T0, 180_000, T0 + 180_000)).toBeNull();
  });
});
