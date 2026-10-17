/**
 * Pure, input-agnostic press-and-hold state machine used by HoldButton.
 * Pointer and keyboard both feed the same start / cancel / tick calls, so a
 * keyboard hold needs exactly the same full duration as a pointer hold.
 * Time is always passed in (never read here) so it is trivially unit-testable.
 */

/** default hold duration before the action fires */
export const HOLD_DEFAULT_MS = 1500;
/** how long the completed fill stays visible before the button resets */
export const HOLD_RELEASE_MS = 250;

export interface HoldState {
  /** timestamp of the active hold's start, or null when idle */
  readonly startedAt: number | null;
  /** true once this hold completed (until released) */
  readonly fired: boolean;
}

const IDLE: HoldState = Object.freeze({ startedAt: null, fired: false });

export const idleHold = (): HoldState => IDLE;

/**
 * Begin a hold. Ignored (same state object returned) while a hold is already
 * counting; a start right after completion begins a fresh hold.
 */
export function startHold(state: HoldState, now: number): HoldState {
  if (state.startedAt !== null && !state.fired) return state;
  return { startedAt: now, fired: false };
}

/** Early release / blur / unmount: abandon an in-progress hold. No-op when idle or already completed. */
export function cancelHold(state: HoldState): HoldState {
  if (state.fired || state.startedAt === null) return state;
  return IDLE;
}

/** Return a completed (or any) machine to idle once the completed visual has been shown. */
export function releaseHold(_state: HoldState): HoldState {
  return IDLE;
}

/** Progress 0..1 of the active hold at time `now`; 0 when idle; clamped. */
export function holdProgress(state: HoldState, now: number, durationMs: number): number {
  if (state.startedAt === null) return 0;
  if (state.fired) return 1;
  const p = (now - state.startedAt) / durationMs;
  if (!(p > 0)) return 0;
  return p >= 1 ? 1 : p;
}

export interface HoldTick {
  state: HoldState;
  progress: number;
  /** true on exactly one tick per hold: the one that reaches the full duration */
  complete: boolean;
}

/** Advance the machine to time `now`; decides whether the hold just completed. */
export function tickHold(state: HoldState, now: number, durationMs: number): HoldTick {
  if (state.startedAt === null || state.fired) {
    return { state, progress: holdProgress(state, now, durationMs), complete: false };
  }
  const progress = holdProgress(state, now, durationMs);
  if (progress >= 1) {
    return { state: { startedAt: state.startedAt, fired: true }, progress: 1, complete: true };
  }
  return { state, progress, complete: false };
}

/** Keys that press-and-hold the button, like a pointer press. */
export const isHoldKey = (key: string): boolean => key === ' ' || key === 'Enter';
