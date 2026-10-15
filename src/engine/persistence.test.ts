import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CORRUPT_STORAGE_KEY,
  STALE_SESSION_MS,
  STORAGE_KEY,
  emptySession,
  getSaveOk,
  isStaleSession,
  loadPersisted,
  migrateV1,
  sanitizeSession,
  writePersisted,
} from './persistence';

const T0 = 1_700_000_000_000;

const v1 = {
  version: 1,
  status: 'active',
  startedAt: T0,
  pausedAt: null,
  pausedAccumMs: 0,
  cycleStartedAt: T0,
  cyclePausedAccumMs: 0,
  cycleIndex: 3,
  events: [
    { id: 'a', at: T0, t: 0, category: 'system', label: 'Code Initiated' },
    { id: 'b', at: T0 + 1000, t: 1000, category: 'crisis', label: 'LAST Declared' },
  ],
  shocks: [{ at: T0 + 5000, t: 5000, joules: 200, shockable: true }],
  epi: [{ at: T0 + 6000, t: 6000, label: 'Epinephrine 1 mg IV/IO', mg: 1 }],
  amio: [],
  crisisDoses: [{ at: T0, t: 0, label: 'Lipid 100 mL' }],
  airwayPlaced: true,
  ventilationStarted: true,
  causes: { hypoxia: true, thrombosis: true },
  metronome: { on: true, audio: false, haptic: true, bpm: 110 },
  weightKg: 82,
  crisis: { maternalStartedAt: null, cicoDeclaredAt: null, mhDeclaredAt: null, lastDeclaredAt: T0 },
  settings: { epiLockoutMs: 240_000, defaultJoules: 200 },
  savedAt: T0 + 7000,
};

describe('migrateV1', () => {
  const m = migrateV1(v1)!;

  it('produces a v2 session that preserves the running code', () => {
    expect(m.version).toBe(2);
    expect(m.status).toBe('active');
    expect(m.startedAt).toBe(T0);
    expect(m.cycleIndex).toBe(3);
    expect(m.shocks).toHaveLength(1);
    expect(m.epi).toHaveLength(1);
    expect(m.weightKg).toBe(82);
    expect(m.settings.epiLockoutMs).toBe(240_000);
    expect(m.metronome.audio).toBe(false);
  });

  it('drops perioperative crisis state and re-files crisis events', () => {
    expect(m).not.toHaveProperty('crisis');
    expect(m).not.toHaveProperty('crisisDoses');
    expect(m.events).toHaveLength(2);
    expect(m.events[1].category).toBe('system');
  });

  it('maps the old thrombosis cause and defaults new fields', () => {
    expect(m.causes).toEqual({ hypoxia: true, thrombosis_pulmonary: true });
    expect(m.airwayType).toBe('ETT');
    expect(m.lido).toEqual([]);
    expect(m.rhythmBranch).toBeNull();
    expect(m.antiarrhythmic).toBe('amiodarone');
    expect(m.pocus).toEqual({});
  });

  it('rejects non-v1 payloads', () => {
    expect(migrateV1(null)).toBeNull();
    expect(migrateV1({ version: 2, events: [] })).toBeNull();
    expect(migrateV1({ version: 1 })).toBeNull();
  });
});

describe('emptySession', () => {
  it('starts idle with ACLS defaults', () => {
    const e = emptySession();
    expect(e.version).toBe(2);
    expect(e.status).toBe('idle');
    expect(e.metronome.bpm).toBe(110);
    expect(e.settings.epiLockoutMs).toBe(180_000);
  });
});

/** A valid mid-code v2 snapshot. */
function good() {
  return {
    ...emptySession(),
    status: 'active' as const,
    startedAt: T0,
    cycleStartedAt: T0,
    events: [{ id: 'a', at: T0, t: 0, category: 'system' as const, label: 'Code Blue activated' }],
    savedAt: T0 + 1000,
  };
}

describe('sanitizeSession', () => {
  it('accepts a valid snapshot unchanged', () => {
    expect(sanitizeSession(JSON.parse(JSON.stringify(good())))).toEqual(good());
  });

  it('rejects wrong version, non-objects and bad status', () => {
    expect(sanitizeSession(null)).toBeNull();
    expect(sanitizeSession([])).toBeNull();
    expect(sanitizeSession({ ...good(), version: 3 })).toBeNull();
    expect(sanitizeSession({ ...good(), status: 'exploding' })).toBeNull();
  });

  it('rejects malformed events, timestamps and doses', () => {
    expect(sanitizeSession({ ...good(), events: [null] })).toBeNull();
    expect(sanitizeSession({ ...good(), events: [{ id: 'x', at: 'now', t: 0, category: 'system', label: 'x' }] })).toBeNull();
    expect(sanitizeSession({ ...good(), events: [{ id: 'x', at: T0, t: 0, category: 'bogus', label: 'x' }] })).toBeNull();
    expect(sanitizeSession({ ...good(), epi: [{ at: T0, t: 0 }] })).toBeNull();
    expect(sanitizeSession({ ...good(), startedAt: Number.NaN })).toBeNull();
    expect(sanitizeSession({ ...good(), pausedAccumMs: -5 })).toBeNull();
    expect(sanitizeSession({ ...good(), causes: { hypoxia: 'yes' } })).toBeNull();
  });

  it('rejects broken clock invariants', () => {
    expect(sanitizeSession({ ...good(), startedAt: null })).toBeNull();
    expect(sanitizeSession({ ...good(), status: 'paused', pausedAt: null })).toBeNull();
  });

  it('fills missing optional fields and falls back per-field for preferences', () => {
    const { lido: _l, pocus: _p, ...rest } = good();
    const s = sanitizeSession({ ...rest, metronome: { bpm: 'fast', audio: false }, settings: { epiLockoutMs: 240_000 } })!;
    expect(s.lido).toEqual([]);
    expect(s.pocus).toEqual({});
    expect(s.metronome.bpm).toBe(110);
    expect(s.metronome.audio).toBe(false);
    expect(s.settings).toEqual({ epiLockoutMs: 240_000, defaultJoules: 200 });
  });
});

describe('loadPersisted / writePersisted', () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it('loads a valid session', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage });
    store.set(STORAGE_KEY, JSON.stringify(good()));
    expect(loadPersisted()?.status).toBe('active');
  });

  it('boots idle (null) on truncated JSON and parks the payload instead of destroying it', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage });
    const truncated = JSON.stringify(good()).slice(0, 40);
    store.set(STORAGE_KEY, truncated);
    expect(loadPersisted()).toBeNull();
    expect(store.has(STORAGE_KEY)).toBe(false);
    expect(store.get(CORRUPT_STORAGE_KEY)).toBe(truncated);
  });

  it('boots idle on structurally invalid events', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage });
    store.set(STORAGE_KEY, JSON.stringify({ ...good(), events: [{ nope: true }] }));
    expect(loadPersisted()).toBeNull();
    expect(store.has(CORRUPT_STORAGE_KEY)).toBe(true);
  });

  it('does not throw when storage itself throws', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(loadPersisted()).toBeNull();
  });

  it('reports a failed write (quota) via the return value and save status, then recovers', () => {
    let full = true;
    vi.stubGlobal('window', {
      localStorage: {
        ...fakeStorage,
        setItem: (k: string, v: string) => {
          if (full) throw new Error('QuotaExceededError');
          store.set(k, v);
        },
      },
    });
    expect(writePersisted(good())).toBe(false);
    expect(getSaveOk()).toBe(false);
    full = false;
    expect(writePersisted(good())).toBe(true);
    expect(getSaveOk()).toBe(true);
  });
});

describe('isStaleSession', () => {
  const now = T0 + STALE_SESSION_MS + 1;
  it('flags an in-progress session older than the threshold', () => {
    expect(isStaleSession({ status: 'active', savedAt: T0 }, now)).toBe(true);
    expect(isStaleSession({ status: 'rosc', savedAt: T0 }, now)).toBe(true);
  });
  it('does not flag recent, finished or never-saved sessions', () => {
    expect(isStaleSession({ status: 'active', savedAt: T0 + 60_000 }, T0 + 120_000)).toBe(false);
    expect(isStaleSession({ status: 'terminated', savedAt: T0 }, now)).toBe(false);
    expect(isStaleSession({ status: 'idle', savedAt: T0 }, now)).toBe(false);
    expect(isStaleSession({ status: 'active', savedAt: 0 }, now)).toBe(false);
  });
});
