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
  const run = { startedAt: T0, endedAt: null, roscAccumMs: 0 };

  it('is zero before the code starts', () => {
    expect(masterElapsedMs({ startedAt: null, endedAt: null, roscAccumMs: 0 }, T0)).toBe(0);
  });
  it('counts wall time while running (CPR pauses included)', () => {
    expect(masterElapsedMs(run, T0 + 90_000)).toBe(90_000);
  });
  it('freezes at endedAt (ROSC / termination)', () => {
    expect(masterElapsedMs({ ...run, endedAt: T0 + 30_000 }, T0 + 500_000)).toBe(30_000);
  });
  it('subtracts closed ROSC intervals', () => {
    expect(masterElapsedMs({ ...run, roscAccumMs: 20_000 }, T0 + 80_000)).toBe(60_000);
  });
  it('never goes negative', () => {
    expect(masterElapsedMs({ ...run, roscAccumMs: 1e12 }, T0)).toBe(0);
  });
});

describe('cycleElapsedMs / cycleRemainingMs', () => {
  const base = { pausedAt: null, cyclePausedAccumMs: 0 };

  it('treats a fresh, unstarted cycle as fully elapsed', () => {
    expect(cycleElapsedMs({ ...base, cycleStartedAt: null }, T0)).toBe(CYCLE_MS);
    expect(cycleRemainingMs({ ...base, cycleStartedAt: null }, T0)).toBe(0);
  });
  it('counts down inside the cycle', () => {
    expect(cycleRemainingMs({ ...base, cycleStartedAt: T0 }, T0 + 45_000)).toBe(CYCLE_MS - 45_000);
  });
  it('clamps elapsed at the cycle length', () => {
    const s = { ...base, cycleStartedAt: T0 };
    expect(cycleElapsedMs(s, T0 + 10 * CYCLE_MS)).toBe(CYCLE_MS);
    expect(cycleRemainingMs(s, T0 + 10 * CYCLE_MS)).toBe(0);
  });
  it('is independent of the master clock after a mid-cycle reset', () => {
    expect(masterElapsedMs({ startedAt: T0, endedAt: null, roscAccumMs: 0 }, T0 + 605_000)).toBe(605_000);
    expect(cycleRemainingMs({ ...base, cycleStartedAt: T0 + 600_000 }, T0 + 605_000)).toBe(CYCLE_MS - 5_000);
  });
  it('freezes the cycle while CPR is paused', () => {
    const s = { pausedAt: T0 + 40_000, cyclePausedAccumMs: 0, cycleStartedAt: T0 };
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
