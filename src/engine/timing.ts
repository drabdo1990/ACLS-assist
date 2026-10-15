/**
 * Pure time math for ResusCode.
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

export interface ArrestClockState {
  startedAt: number | null;
  /** Freeze point: ROSC or termination time; null while the arrest is ongoing. */
  endedAt: number | null;
  /** Sum of closed ROSC intervals. */
  roscAccumMs: number;
}

export interface CycleClockState {
  pausedAt: number | null;
  cycleStartedAt: number | null;
  cyclePausedAccumMs: number;
}

/**
 * Total arrest time (ms): activation → end (or now) minus ROSC intervals.
 * CPR pauses COUNT — the patient is still in arrest while compressions are paused.
 */
export function masterElapsedMs(s: ArrestClockState, now: number): number {
  if (s.startedAt == null) return 0;
  const ref = s.endedAt ?? now;
  return Math.max(0, ref - s.startedAt - s.roscAccumMs);
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

/** Human duration for summaries: "6m 45s", "1h 02m 05s", "45s". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${pad2(m)}m ${pad2(s)}s`;
  if (m > 0) return `${m}m ${pad2(s)}s`;
  return `${s}s`;
}

/** Local time-of-day HH:MM:SS for an absolute epoch timestamp (for documentation). */
export function formatWallClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Same as formatClock; kept separate for intent (countdowns) at call sites. */
export function formatCountdown(ms: number): string {
  return formatClock(ms);
}

/**
 * Milliseconds remaining until epinephrine may be re-dosed (0 when eligible).
 *
 * Clock model — which clock governs what:
 * - Audit timestamps (`CodeEvent.at`) and this drug re-dose interval use real wall-clock time:
 *   a drug's interval keeps running while CPR is paused, so it is deliberately NOT pause-aware.
 * - `CodeEvent.t` / the master clock are arrest time — CPR pauses included, ROSC periods excluded.
 * - The 2-minute cycle has its own pause-aware clock, independent of the master clock.
 */
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
