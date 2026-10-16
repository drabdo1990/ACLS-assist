import { useMemo, useSyncExternalStore } from 'react';
import { getServiceVersion, kv, subscribeService } from '../engine/service';
import { loadHistory, type CodeRecord } from '../engine/history';
import { loadPrefs, type Prefs } from '../engine/prefs';
import { loadOutbox, type OutboxState } from '../engine/outbox';

/** Bumps whenever history / outbox / prefs change (this tab or another). */
export function useServiceVersion(): number {
  return useSyncExternalStore(subscribeService, getServiceVersion, () => 0);
}

/** Newest first. */
export function useHistoryRecords(): CodeRecord[] {
  const v = useServiceVersion();
  return useMemo(() => (kv ? loadHistory(kv).reverse() : []), [v]);
}

export function usePrefsState(): Prefs {
  const v = useServiceVersion();
  return useMemo(() => loadPrefs(kv), [v]);
}

export function useOutboxState(): OutboxState {
  const v = useServiceVersion();
  return useMemo(() => (kv ? loadOutbox(kv) : { entries: {}, lastRejection: null }), [v]);
}
