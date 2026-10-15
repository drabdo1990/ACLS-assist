import { describe, it, expect } from 'vitest';
import { buildSbar, sbarFilename, type SbarInput } from './sbar';
import type { CodeEvent } from './types';
import { formatWallClock } from './timing';
import { POST_ROSC_BUNDLE } from '../content/protocols';

const T0 = 1_700_000_000_000;

function ev(t: number, category: CodeEvent['category'], label: string, detail?: string): CodeEvent {
  return { id: `${t}-${label}`, at: T0 + t, t, category, label, detail };
}

const base: SbarInput = {
  status: 'rosc',
  startedAt: T0,
  pausedAt: T0 + 405_000,
  pausedAccumMs: 0,
  events: [
    ev(0, 'system', 'Code Blue activated'),
    ev(45_000, 'shock', 'Defibrillation: Shock #1 (200J Biphasic)'),
    ev(70_000, 'drug', 'Epinephrine 1 mg IV/IO', 'Dose #1 · repeat every 3–5 min'),
    ev(120_000, 'cycle', 'Cycle 1 completed', 'Rhythm: VF · switch compressors'),
    ev(120_000, 'rhythm', 'Rhythm check — VF'),
    ev(160_000, 'airway', 'Advanced airway placed — ETT'),
    ev(260_000, 'drug', 'Amiodarone 300 mg IV/IO', 'First dose'),
    ev(405_000, 'rosc', 'ROSC declared', 'Total arrest duration: 6m 45s. Total shocks: 1. Total epi: 1 mg.'),
  ],
  shocks: [{ at: T0 + 45_000, t: 45_000, joules: 200, shockable: true, waveform: 'biphasic' }],
  epi: [{ at: T0 + 70_000, t: 70_000, label: 'Epinephrine 1 mg IV/IO', mg: 1 }],
  amio: [{ at: T0 + 260_000, t: 260_000, label: 'Amiodarone 300 mg IV/IO', mg: 300 }],
  lido: [],
  rhythmBranch: 'shockable',
  airwayPlaced: true,
  airwayType: 'ETT',
  causes: { hypoxia: true, thrombosis_coronary: true },
  pocus: { effusion: false, rv_strain: true },
  weightKg: 70,
};

describe('buildSbar', () => {
  const text = buildSbar(base, T0 + 500_000);

  it('is titled ResusCode, PHI-free, and states the outcome', () => {
    expect(text).toContain('ResusCode — RESUSCITATION SUMMARY');
    expect(text).toContain('PHI-free');
    expect(text).toContain('Outcome: ROSC achieved');
  });

  it('reports total arrest time frozen at ROSC', () => {
    expect(text).toContain('Total arrest time: 06:45 (6m 45s)');
  });

  it('summarises branch, airway, shocks and doses', () => {
    expect(text).toContain('Rhythm branch: Shockable (VF / pulseless VT)');
    expect(text).toContain('Advanced airway: ETT placed');
    expect(text).toContain('Shocks delivered: 1');
    expect(text).toContain('Epinephrine: 1 dose (total 1 mg)');
    expect(text).toContain('Amiodarone doses: 1 (300 mg)');
    expect(text).toContain('Lidocaine doses: 0');
    expect(text).toContain('Defibrillation energies: 200J Biphasic');
  });

  it('lists rhythms, causes and POCUS findings', () => {
    expect(text).toContain('Rhythms documented: VF');
    expect(text).toContain('Reversible causes addressed: Hypoxia, Thrombosis (coronary)');
    expect(text).toContain('POCUS findings: RV dilatation / strain');
  });

  it('recommends the SHA post-ROSC bundle after ROSC', () => {
    expect(text).toContain('Post-ROSC bundle');
    expect(text).toContain('Cath Lab');
    expect(text).toContain('dopamine 5–10 mcg/kg/min');
    expect(text).toContain('32–37.5 °C for 12–24 h');
    expect(text).toContain('SHA ACLS 2024');
  });

  it('includes a bracketed, chronological timeline', () => {
    expect(text).toContain(`[00:00] ${formatWallClock(T0)}  Code Blue activated`);
    expect(text).toContain(`[00:45] ${formatWallClock(T0 + 45_000)}  Defibrillation: Shock #1 (200J Biphasic)`);
    expect(text).toContain(`[06:45] ${formatWallClock(T0 + 405_000)}  ROSC declared`);
    expect(text.indexOf('Shock #1 (200J')).toBeLessThan(text.indexOf('[01:10]'));
  });

  it('handles an empty session gracefully', () => {
    const empty = buildSbar({ ...base, events: [], status: 'idle', startedAt: null, pausedAt: null }, T0);
    expect(empty).toContain('(no events)');
    expect(empty).toContain('Outcome: No cardiac arrest recorded');
    expect(empty).not.toContain('Post-ROSC bundle');
  });

  it('does not recommend post-ROSC care for a terminated code', () => {
    const ended = buildSbar({ ...base, status: 'terminated' }, T0 + 500_000);
    expect(ended).toContain('Outcome: Resuscitation terminated');
    expect(ended).not.toContain('Post-ROSC bundle');
  });
});

describe('post-ROSC care section', () => {
  const [first, second] = POST_ROSC_BUNDLE;

  it('lists completed vs not-yet-recorded bundle items after ROSC', () => {
    const events = [
      ...base.events,
      ev(410_000, 'post', `Post-ROSC: ${first.text}`),
      ev(420_000, 'post', `Post-ROSC: ${second.text}`),
      ev(430_000, 'post', `Post-ROSC (unchecked): ${second.text}`),
    ];
    const text = buildSbar({ ...base, events }, T0 + 500_000);
    expect(text).toContain('=== POST-ROSC CARE ===');
    expect(text).toContain(`Completed (1/${POST_ROSC_BUNDLE.length}):`);
    expect(text).toContain(`[x] ${first.text}`);
    expect(text).toContain(`[ ] ${second.text}`); // un-ticked again, so pending
  });

  it('says nothing was recorded when no item is ticked', () => {
    const text = buildSbar(base, T0 + 500_000);
    expect(text).toContain('(none recorded)');
  });

  it('is omitted when ROSC never occurred (no misleading "all pending" list)', () => {
    const events = base.events.filter((e) => e.category !== 'rosc');
    const text = buildSbar({ ...base, status: 'terminated', events }, T0 + 500_000);
    expect(text).not.toContain('POST-ROSC CARE');
  });
});

describe('sbarFilename', () => {
  it('is filename-safe and ends with .txt', () => {
    expect(sbarFilename(T0)).toMatch(/^resuscode-sbar-\d{8}-\d{4}\.txt$/);
  });
});
