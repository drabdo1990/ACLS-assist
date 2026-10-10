import { useEffect, useState } from 'react';
import { useCodeStore } from '../engine/store';
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
  const [active, setActive] = useState(isWakeLockActive());

  useEffect(() => subscribeWakeLock(setActive), []);

  useEffect(() => {
    if (status === 'active' || status === 'paused') {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }
  }, [status]);

  return { active, supported: isWakeLockSupported() };
}
