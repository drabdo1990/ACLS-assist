import { describe, it, expect } from 'vitest';
import { buildSbar, sbarFilename, type SbarInput } from './sbar';
import type { CodeEvent, CrisisTimers } from './types';

const T0 = 1_700_000_000_000;

const crisis: CrisisTimers = {
  maternalStartedAt: null,
  cicoDeclaredAt: null,
  mhDeclaredAt: null,
  lastDeclaredAt: null,
};

function ev(t: number, category: CodeEvent['category'], label: string, detail?: string): CodeEvent {
  return { id: `${t}`, at: T0 + t, t, category, label, detail };
}

const base: SbarInput = {
  status: 'rosc',
  startedAt: T0,
  pausedAt: null,
  pausedAccumMs: 0,
  events: [
    ev(0, 'system', 'Code Initiated', 'Cardiac arrest recognised — CPR started'),
    ev(75_000, 'shock', 'Defibrillation 200 J', 'Shock #1'),
    ev(120_000, 'cycle', 'Cycle 1 complete', 'Rhythm check / switch compressor'),
    ev(135_000, 'drug', 'Epinephrine 1 mg IV/IO', 'Repeat every 3–5 min'),
    ev(270_000, 'drug', 'Amiodarone 300 mg IV/IO', 'First dose'),
    ev(492_000, 'rosc', 'ROSC Achieved', 'Return of spontaneous circulation'),
  ],
  shocks: [{ at: T0 + 75_000, t: 75_000, joules: 200, shockable: true }],
  epi: [{ at: T0 + 135_000, t: 135_000, label: 'Epinephrine 1 mg IV/IO', mg: 1 }],
  amio: [{ at: T0 + 270_000, t: 270_000, label: 'Amiodarone 300 mg IV/IO', mg: 300 }],
  airwayPlaced: true,
  causes: { hypoxia: true, hypovolemia: true },
  weightKg: 70,
  crisis,
};

describe('buildSbar', () => {
  const text = buildSbar(base, T0 + 492_000);

  it('marks the report PHI-free and states the outcome', () => {
    expect(text).toContain('CodeOR — RESUSCITATION SUMMARY');
    expect(text).toContain('PHI-free');
    expect(text).toContain('Outcome: ROSC achieved');
  });

  it('reports total arrest time from timestamps', () => {
    expect(text).toContain('Total arrest time: 08:12');
  });

  it('summarises doses, shocks and airway in BACKGROUND', () => {
    expect(text).toContain('Shocks delivered: 1');
    expect(text).toContain('Epinephrine doses: 1');
    expect(text).toContain('Amiodarone doses: 1');
    expect(text).toContain('Advanced airway: placed');
    expect(text).toContain('Protocol weight used: 70 kg');
  });

  it('lists addressed reversible causes', () => {
    expect(text).toContain('Reversible causes addressed: Hypoxia, Hypovolemia');
  });

  it('includes a chronological timeline with the key events', () => {
    expect(text).toContain('00:00  Code Initiated');
    expect(text).toContain('01:15  Defibrillation 200 J — Shock #1');
    expect(text).toContain('08:12  ROSC Achieved');
    // ordering: 01:15 must appear before 02:15
    expect(text.indexOf('01:15  Defibrillation')).toBeLessThan(text.indexOf('02:15  Epinephrine'));
  });

  it('handles an empty event list gracefully', () => {
    const empty = buildSbar({ ...base, events: [], status: 'idle', startedAt: null }, T0);
    expect(empty).toContain('(no events)');
    expect(empty).toContain('Total arrest time: 00:00');
  });
});

describe('sbarFilename', () => {
  it('is filename-safe and endswith .txt', () => {
    const name = sbarFilename(T0);
    expect(name).toMatch(/^codeor-sbar-\d{8}-\d{4}\.txt$/);
  });
});
