import { useEffect, useState } from 'react';
import { hasCrisisClock, useCodeStore } from '../engine/store';
import {
  isWakeLockActive,
  isWakeLockSupported,
  releaseWakeLock,
  requestWakeLock,
  subscribeWakeLock,
} from '../engine/wakeLock';

/**
 * Holds a screen Wake Lock for the entire duration of an active or paused code.
 * Re-acquires automatically after the tab is backgrounded and returns.
 */
export function useWakeLock(): { active: boolean; supported: boolean } {
  const status = useCodeStore((s) => s.status);
  const crisisClock = useCodeStore(hasCrisisClock);
  const [active, setActive] = useState(isWakeLockActive());

  useEffect(() => subscribeWakeLock(setActive), []);

  // Post-ROSC care (and possible re-arrest) and declared crises also need the screen awake.
  const want = status === 'active' || status === 'paused' || status === 'rosc' || crisisClock;
  useEffect(() => {
    if (want) {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }
  }, [want]);

  return { active, supported: isWakeLockSupported() };
}
