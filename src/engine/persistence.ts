/**
 * Persistence — localStorage auto-save so an accidental page refresh (or the OS
 * killing a backgrounded tab) never loses a code.
 *
 * No PHI is stored: the payload contains only timestamps, protocol inputs, and
 * event labels. Nothing ever leaves the device.
 */

import type { PersistedSession } from './types';

export const STORAGE_KEY = 'codeor.session.v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadPersisted(): PersistedSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.events)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePersisted(session: PersistedSession): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota or private-mode failure — the in-memory session still works */
  }
}

export function clearPersisted(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Debounced writer: the store mutates frequently (ticker-driven), so we coalesce
 * writes. `flush` is called on pagehide to guarantee the final state is durable.
 */
export function createDebouncedWriter(delayMs = 400) {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let pending: PersistedSession | null = null;

  const flush = () => {
    if (handle != null) {
      clearTimeout(handle);
      handle = null;
    }
    if (pending) {
      writePersisted(pending);
      pending = null;
    }
  };

  const save = (session: PersistedSession) => {
    pending = session;
    if (handle != null) return;
    handle = setTimeout(() => {
      handle = null;
      if (pending) {
        writePersisted(pending);
        pending = null;
      }
    }, delayMs);
  };

  return { save, flush };
}
