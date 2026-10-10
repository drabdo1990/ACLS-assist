/**
 * Pure time math for CodeOR.
 *
 * Design law: absolute timestamps are the source of truth; the render ticker only
 * repaints. This makes the master clock and the 2-minute cycle resilient to page
 * refreshes, background throttling, and pause/resume without accumulating drift.
 *
 * All functions here are pure and fully unit-tested (see timing.test.ts).
 */

export const CYCLE_MS = 120_000; // 2:00 CPR cycle
export const WARN_MS = 30_000; // cyan -> amber
export const CRIT_MS = 10_000; // amber -> flashing red + alarm

export interface ClockState {
  startedAt: number | null;
  pausedAt: number | null;
  pausedAccumMs: number;
}

export interface CycleClockState extends ClockState {
  cycleStartedAt: number | null;
  cyclePausedAccumMs: number;
}

/** Total elapsed arrest time (ms), pause-aware. */
export function masterElapsedMs(s: ClockState, now: number): number {
  if (s.startedAt == null) return 0;
  const ref = s.pausedAt ?? now;
  return Math.max(0, ref - s.startedAt - s.pausedAccumMs);
}

/** Elapsed time within the current CPR cycle (ms), pause-aware and independent of the master clock. */
export function cycleElapsedMs(s: CycleClockState, now: number): number {
  if (s.cycleStartedAt == null) return CYCLE_MS;
  const ref = s.pausedAt ?? now;
  const elapsed = ref - s.cycleStartedAt - s.cyclePausedAccumMs;
  return Math.max(0, Math.min(CYCLE_MS, elapsed));
}

/** Time remaining in the current CPR cycle (ms), clamped to [0, CYCLE_MS]. */
export function cycleRemainingMs(s: CycleClockState, now: number): number {
  return Math.max(0, CYCLE_MS - cycleElapsedMs(s, now));
}

export type CyclePhase = 'cruise' | 'warn' | 'crit';

export function cyclePhase(remainingMs: number): CyclePhase {
  if (remainingMs <= CRIT_MS) return 'crit';
  if (remainingMs <= WARN_MS) return 'warn';
  return 'cruise';
}

/** Fraction of the cycle completed, 0..1 — used to fill the progress ring. */
export function cycleProgress(remainingMs: number): number {
  const done = CYCLE_MS - Math.max(0, Math.min(CYCLE_MS, remainingMs));
  return done / CYCLE_MS;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Format ms as MM:SS, promoting to H:MM:SS past one hour.
 * Always returns the same number of digits for a given magnitude to avoid
 * visual jumpiness in the giant monospace readout.
 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${pad2(m)}:${pad2(s)}`;
}

/** Same as formatClock; kept separate for intent (countdowns) at call sites. */
export function formatCountdown(ms: number): string {
  return formatClock(ms);
}

/** Milliseconds remaining until epinephrine may be re-dosed (0 when eligible). */
export function epiLockoutRemainingMs(
  lastDoseAt: number | null | undefined,
  lockoutMs: number,
  now: number,
): number {
  if (lastDoseAt == null) return 0;
  return Math.max(0, lastDoseAt + lockoutMs - now);
}

/** mm:ss string for a dose lockout that is still counting down, or null when eligible. */
export function epiLockoutLabel(
  lastDoseAt: number | null | undefined,
  lockoutMs: number,
  now: number,
): string | null {
  const remaining = epiLockoutRemainingMs(lastDoseAt, lockoutMs, now);
  if (remaining <= 0) return null;
  return formatCountdown(remaining);
}
