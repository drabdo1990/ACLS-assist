import { useEffect } from 'react';
import { useCodeStore } from '../engine/store';
import { clockNow, resyncClock } from '../engine/clock';

/**
 * Single app-wide render ticker. Updates `now` in the store so every clock
 * re-derives from real timestamps. rAF-based (throttled to ~5 Hz) on the monotonic
 * hybrid clock, and paused entirely when there is no running code (battery).
 */
export function useTicker(): void {
  const status = useCodeStore((s) => s.status);
  const tick = useCodeStore((s) => s.tick);
  const metronomeOn = useCodeStore((s) => s.metronome.on);

  useEffect(() => {
    const live = status === 'active' || status === 'paused';
    tick(clockNow());
    if (!live && !metronomeOn) return;

    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= 200) {
        last = t;
        tick(clockNow());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onVisible = () => {
      resyncClock();
      last = 0;
      tick(clockNow());
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [status, metronomeOn, tick]);
}

/** Current ticker value. Only components that need live time should use this. */
export function useNow(): number {
  return useCodeStore((s) => s.now);
}
