import { useEffect } from 'react';
import { hasCrisisClock, useCodeStore } from '../engine/store';

/**
 * Single app-wide render ticker. Updates `now` in the store so every clock
 * re-derives from real timestamps. rAF-based (throttled to ~5 Hz) and paused
 * entirely when there is no running code, which keeps the battery cost low.
 */
export function useTicker(): void {
  const status = useCodeStore((s) => s.status);
  const tick = useCodeStore((s) => s.tick);
  const metronomeOn = useCodeStore((s) => s.metronome.on);
  const crisisClock = useCodeStore(hasCrisisClock);

  useEffect(() => {
    // Keep the clock fresh for a running/paused code, a live metronome, or a declared
    // crisis (maternal / CICO countdowns run independently of the arrest clock).
    const live = status === 'active' || status === 'paused' || crisisClock;
    tick(Date.now());
    if (!live && !metronomeOn) return;

    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= 200) {
        last = t;
        tick(Date.now());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onVisible = () => {
      last = 0;
      tick(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [status, metronomeOn, crisisClock, tick]);
}

/** Current ticker value. Only components that need live time should use this. */
export function useNow(): number {
  return useCodeStore((s) => s.now);
}
