import { useSyncExternalStore } from 'react';
import { TriangleAlert, VolumeX } from 'lucide-react';
import { ensureAudio, isAudioReady, isAudioSupported, subscribeAudioState } from '../../engine/audio';
import { getSaveOk, subscribeSaveStatus } from '../../engine/persistence';
import { useCodeStore } from '../../engine/store';

/**
 * Shown while a code is running and the browser has not (yet) allowed sound — e.g. after a
 * reload, before the first tap. The alarms are silent in that state, so say so and let one tap fix it.
 */
export function AudioHint() {
  const status = useCodeStore((s) => s.status);
  const ready = useSyncExternalStore(subscribeAudioState, isAudioReady, () => true);
  if ((status !== 'active' && status !== 'paused') || ready || !isAudioSupported()) return null;
  return (
    <button
      type="button"
      onClick={() => ensureAudio()}
      className="touch-hit flex items-center gap-1 rounded-full border border-warn/60 bg-warn/10 px-2 py-1 text-[10px] font-bold text-warn"
    >
      <VolumeX className="h-3 w-3" /> SOUND OFF — TAP
    </button>
  );
}

/** Shown when the latest session state could not be written to storage. */
export function SaveFailedChip() {
  const ok = useSyncExternalStore(subscribeSaveStatus, getSaveOk, () => true);
  if (ok) return null;
  return (
    <span
      title="Storage is unavailable or full — a page reload would lose the current session"
      className="flex items-center gap-1 rounded-full border border-crit/60 px-2 py-1 text-[10px] font-bold text-crit"
    >
      <TriangleAlert className="h-3 w-3" /> NOT SAVED
    </span>
  );
}
