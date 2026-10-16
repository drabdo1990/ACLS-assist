import type { KV } from '../kv';

export interface MemoryKV extends KV {
  data: Map<string, string>;
  /** When true, `set` returns false (simulates a full / blocked store). */
  failWrites: boolean;
}

export function memoryKV(seed: Record<string, string> = {}): MemoryKV {
  const data = new Map(Object.entries(seed));
  const kv: MemoryKV = {
    data,
    failWrites: false,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => {
      if (kv.failWrites) return false;
      data.set(k, v);
      return true;
    },
    remove: (k) => {
      data.delete(k);
    },
  };
  return kv;
}

/** A KV whose every call throws — for "history must never break the app" tests. */
export function throwingKV(): KV {
  const boom = (): never => {
    throw new Error('storage exploded');
  };
  return { get: boom, set: boom, remove: boom };
}
