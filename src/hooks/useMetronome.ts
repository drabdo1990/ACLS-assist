import { useEffect, useRef, useState } from 'react';
import { useCodeStore } from '../engine/store';
import { ensureAudio, scheduleClick } from '../engine/audio';
import { haptic } from '../engine/haptics';

const LOOKAHEAD_S = 0.1; // schedule audio this far ahead
const SCHEDULER_MS = 25; // how often the scheduler wakes
const ACCENT_EVERY = 10; // accent the down-beat every 10th tick (~every 6 s)

/**
 * If the scheduler fell far behind the audio clock (throttled background timer, tab restore),
 * skip the missed beats instead of firing them all at once as one loud burst.
 */
export function catchUpNext(next: number, currentTime: number): number {
  return next < currentTime - LOOKAHEAD_S ? currentTime + 0.02 : next;
}

/**
 * CPR metronome. Uses a lookahead scheduler on a single shared AudioContext so
 * the cadence is rock-steady at 110 bpm (naive setInterval drifts audibly).
 * Returns a beat counter so the visual indicator can pulse in lock-step.
 */
export function useMetronome(): { beat: number; running: boolean } {
  const on = useCodeStore((s) => s.metronome.on);
  const bpm = useCodeStore((s) => s.metronome.bpm);
  const audioOn = useCodeStore((s) => s.metronome.audio);
  const hapticOn = useCodeStore((s) => s.metronome.haptic);
  const status = useCodeStore((s) => s.status);

  const [beat, setBeat] = useState(0);
  // Silent while CPR is paused — a ticking metronome during a pause invites resuming early.
  const running = on && status === 'active' && bpm > 0;

  // Keep latest toggles in refs so the scheduler effect does not restart on every change.
  const audioRef = useRef(audioOn);
  const hapticRef = useRef(hapticOn);
  audioRef.current = audioOn;
  hapticRef.current = hapticOn;

  useEffect(() => {
    if (!running) return;
    const ac = ensureAudio();
    const interval = 60 / bpm;
    let stopped = false;
    let next = ac ? ac.currentTime + 0.08 : 0;
    let count = 0;
    const visualTimers: number[] = [];

    const schedule = () => {
      if (!ac || stopped) return;
      next = catchUpNext(next, ac.currentTime);
      while (next < ac.currentTime + LOOKAHEAD_S) {
        const accent = count % ACCENT_EVERY === 0;
        if (audioRef.current) {
          scheduleClick(next, {
            freq: accent ? 1320 : 880,
            type: 'square',
            gain: accent ? 0.2 : 0.13,
            durationMs: 34,
          });
        }
        const delayMs = Math.max(0, (next - ac.currentTime) * 1000);
        const isHapticBeat = hapticRef.current;
        const id = window.setTimeout(() => {
          if (stopped) return;
          setBeat((b) => b + 1);
          if (isHapticBeat) haptic.tick();
        }, delayMs);
        visualTimers.push(id);
        next += interval;
        count += 1;
      }
    };

    const handle = window.setInterval(schedule, SCHEDULER_MS);
    schedule();

    return () => {
      stopped = true;
      window.clearInterval(handle);
      visualTimers.forEach((id) => window.clearTimeout(id));
    };
  }, [running, bpm]);

  return { beat, running };
}
