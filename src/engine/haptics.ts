/**
 * Haptics — best-effort vibration cues.
 * Android/Chrome support navigator.vibrate; iOS Safari does not. All calls are
 * safe no-ops when unsupported, and every critical cue also has an audio twin.
 */

export type HapticPattern = number | number[];

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

export function vibrate(pattern: HapticPattern): void {
  if (!hapticsSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore — vibration is a non-critical enhancement */
  }
}

export const haptic = {
  /** Short pulse on each metronome beat. */
  tick: () => vibrate(12),
  /** Positive confirmation when an intervention is logged. */
  confirm: () => vibrate(35),
  /** Strong pattern when the 2-minute cycle expires. */
  alarm: () => vibrate([200, 90, 200, 90, 260]),
  /** Soft double pulse on ROSC. */
  rosc: () => vibrate([45, 70, 45]),
  /** Warning buzz. */
  warn: () => vibrate(70),
};
