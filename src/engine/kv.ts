/** Minimal string key/value storage so engine modules can be tested in Node with an in-memory fake. */
export interface KV {
  get(key: string): string | null;
  /** false when the write failed (quota / blocked storage). */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

/** localStorage-backed KV, or null where storage is unavailable (Node, blocked storage). */
export function browserKV(): KV | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
  } catch {
    return null;
  }
  const ls = window.localStorage;
  return {
    get: (k) => {
      try {
        return ls.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        ls.setItem(k, v);
        return true;
      } catch {
        return false;
      }
    },
    remove: (k) => {
      try {
        ls.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };
}
