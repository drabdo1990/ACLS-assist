import { describe, it, expect } from 'vitest';
import { emptySession, migrateV1 } from './persistence';

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
