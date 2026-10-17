/**
 * History flag edits vs. the live session. Pure over an injected KV and store.
 *
 * A History edit of Training/Void changes only the stored record. When that record was captured from
 * the session still held in the store, reset() rebuilds the record from the session's own (old) flags
 * and would overwrite the edit and re-upload the original. So an edit to the live session's record is
 * mirrored onto the live session too: every later capture of it then carries the edited flags.
 */
import type { KV } from './kv';
import { updateRecord, type CodeRecord } from './history';
import { loadPrefs } from './prefs';

export interface FlagPatch {
  training?: boolean;
  voided?: boolean;
}

export interface LiveFlagState {
  startedAt: number | null;
  setTraining: (on: boolean) => void;
  setVoided: (on: boolean) => void;
}

export interface LiveFlagStore {
  getState(): LiveFlagState;
}

/** Record ids are `${startedAt}-${deviceId}` (makeRecordId); the dash keeps a digit-prefix from matching. */
export function liveSessionOwnsRecord(recordId: string, live: { startedAt: number | null }): boolean {
  return live.startedAt != null && recordId.startsWith(`${live.startedAt}-`);
}

/** Mirror a flag edit onto the live session when it owns the record. Returns whether it did. */
export function applyFlagEditToLive(recordId: string, patch: FlagPatch, store: LiveFlagStore): boolean {
  const live = store.getState();
  if (!liveSessionOwnsRecord(recordId, live)) return false;
  if (patch.training !== undefined) live.setTraining(patch.training);
  if (patch.voided !== undefined) live.setVoided(patch.voided);
  return true;
}

/** The full edit: live session first (so it can never be captured with stale flags), then the stored record. */
export function editRecordFlagsCore(kv: KV, store: LiveFlagStore, id: string, patch: FlagPatch): CodeRecord | null {
  applyFlagEditToLive(id, patch, store);
  const prefs = loadPrefs(kv);
  return updateRecord(kv, id, { ...patch, uploadStatus: prefs.enrollment ? 'queued' : 'local' }, prefs.retention);
}
