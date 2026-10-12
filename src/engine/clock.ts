/**
 * Hybrid precision clock.
 *
 * Absolute epoch timestamps remain the persisted source of truth (they survive a
 * refresh, which `performance.now()` does not). Live time, however, advances on the
 * monotonic `performance.now()` delta from an epoch anchor, so a wall-clock change
 * (NTP sync, manual time change) cannot make the running timers jump.
 *
 * Some platforms pause `performance.now()` while the device sleeps. We re-anchor when
 * the page becomes visible again, and whenever the monotonic estimate drifts from
 * `Date.now()` by more than RESYNC_MS (which only happens after a suspend).
 */

export const RESYNC_MS = 1_000;

interface PerfLike {
  now(): number;
}

function perf(): PerfLike | null {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance : null;
}

let anchorEpoch = Date.now();
let anchorPerf = perf()?.now() ?? 0;

/** Re-anchor the monotonic clock to the current wall clock. */
export function resyncClock(): void {
  anchorEpoch = Date.now();
  anchorPerf = perf()?.now() ?? 0;
}

/** Epoch ms advanced by the monotonic clock. Use everywhere instead of Date.now(). */
export function clockNow(): number {
  const p = perf();
  if (!p) return Date.now();
  const mono = Math.round(anchorEpoch + (p.now() - anchorPerf));
  const wall = Date.now();
  if (Math.abs(mono - wall) > RESYNC_MS) {
    // Suspend/resume or a large clock correction: trust the wall clock and re-anchor.
    resyncClock();
    return wall;
  }
  return mono;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resyncClock();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', resyncClock);
}
