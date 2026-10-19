/**
 * Adult golden suite — pins every adult clinical output the profile refactor (phase 4a,
 * `src/content/profiles/adult.ts`) must preserve byte-for-byte. Store event labels/details
 * are pinned separately (`engine/eventKeys.test.ts` + `testing/goldenEvents.json`) and the
 * English SBAR in `engine/testing/goldenSbar.txt`; this file covers the dose engine, the
 * algorithm view and the checklist data the profile wraps.
 *
 * These assertions are intentionally literal: any diff means a clinical value changed,
 * which needs an explicit decision, never a silent test update.
 */
import { describe, it, expect } from 'vitest';
import {
  EPINEPHRINE,
  MAGNESIUM,
  SHOCK_ENERGIES,
  amiodaroneDoseMg,
  lidocaineBudget,
  lidocaineDose,
  waveformFor,
} from './calc';
import { nextAclsStep, type AlgorithmInput } from './algorithm';
import { EN, type MessageKey } from '../i18n/en';
import { POST_ROSC_BUNDLE } from './protocols';
import { CAUSES } from './causes';
import { POCUS_ITEMS } from './pocus';

describe('golden: adult dose engine (content/calc.ts)', () => {
  it('epinephrine reference is unchanged', () => {
    expect(EPINEPHRINE).toEqual({
      label: 'Epinephrine',
      dose: '1 mg',
      route: 'IV / IO',
      detail: '1 mg = 10 mL of 0.1 mg/mL',
      flush: '20 mL NS flush, elevate arm 10–20 s',
      intervalLabel: 'repeat every 3–5 min',
    });
  });

  it('magnesium reference is unchanged', () => {
    expect(MAGNESIUM).toEqual({
      label: 'Magnesium sulfate 1–2 g IV/IO',
      indication: 'Torsades de pointes',
    });
  });

  it('amiodarone sequence 300 → 150 → 150 …', () => {
    expect([0, 1, 2, 3, 4].map(amiodaroneDoseMg)).toEqual([300, 150, 150, 150, 150]);
  });

  it('lidocaine dose table (min/max mg, whole-number rounding)', () => {
    const rows: Array<[number, number, { doseNo: number; perKgLabel: string; minMg: number; maxMg: number }]> = [
      [40, 0, { doseNo: 1, perKgLabel: '1–1.5 mg/kg', minMg: 40, maxMg: 60 }],
      [40, 1, { doseNo: 2, perKgLabel: '0.5–0.75 mg/kg', minMg: 20, maxMg: 30 }],
      [70, 0, { doseNo: 1, perKgLabel: '1–1.5 mg/kg', minMg: 70, maxMg: 105 }],
      [70, 1, { doseNo: 2, perKgLabel: '0.5–0.75 mg/kg', minMg: 35, maxMg: 53 }],
      [70, 2, { doseNo: 3, perKgLabel: '0.5–0.75 mg/kg', minMg: 35, maxMg: 53 }],
      [100, 0, { doseNo: 1, perKgLabel: '1–1.5 mg/kg', minMg: 100, maxMg: 150 }],
      [100, 3, { doseNo: 4, perKgLabel: '0.5–0.75 mg/kg', minMg: 50, maxMg: 75 }],
      [250, 0, { doseNo: 1, perKgLabel: '1–1.5 mg/kg', minMg: 250, maxMg: 375 }],
    ];
    for (const [kg, doseIndex, expected] of rows) expect(lidocaineDose(kg, doseIndex), `${kg} kg #${doseIndex}`).toEqual(expected);
  });

  it('lidocaine 3 mg/kg budget arithmetic', () => {
    expect(lidocaineBudget(40, [])).toEqual({ givenMg: 0, maxMg: 120, nextExceeds: false });
    expect(lidocaineBudget(70, [])).toEqual({ givenMg: 0, maxMg: 210, nextExceeds: false });
    expect(lidocaineBudget(70, [70, 35, 35, 35])).toEqual({ givenMg: 175, maxMg: 210, nextExceeds: false });
    expect(lidocaineBudget(70, [70, 35, 35, 35, 35])).toEqual({ givenMg: 210, maxMg: 210, nextExceeds: true });
    expect(lidocaineBudget(100, [100, 50])).toEqual({ givenMg: 150, maxMg: 300, nextExceeds: false });
  });

  it('shock energies and waveforms', () => {
    expect(SHOCK_ENERGIES).toEqual([
      { joules: 120, waveform: 'biphasic' },
      { joules: 150, waveform: 'biphasic' },
      { joules: 200, waveform: 'biphasic' },
      { joules: 360, waveform: 'monophasic' },
    ]);
    expect(waveformFor(120)).toBe('biphasic');
    expect(waveformFor(150)).toBe('biphasic');
    expect(waveformFor(200)).toBe('biphasic');
    expect(waveformFor(360)).toBe('monophasic');
    expect(waveformFor(999)).toBe('biphasic'); // unknown energy falls back to biphasic
  });
});

describe('golden: adult algorithm view (content/algorithm.ts)', () => {
  const base: AlgorithmInput = { branch: 'shockable', shocks: 0, epi: 0, antiarrhythmic: 0, causesChecked: 0 };

  it('no branch selected', () => {
    expect(nextAclsStep({ ...base, branch: null })).toEqual({
      titleKey: 'algo.title.none',
      steps: [],
      ongoingKey: 'algo.ongoing.none',
      focus: null,
    });
    expect(EN['algo.title.none' as MessageKey]).toBe('Select rhythm branch');
    expect(EN['algo.ongoing.none' as MessageKey]).toBe(
      'Attach monitor/defibrillator, check rhythm, then choose Shockable or Non-shockable.',
    );
  });

  it('shockable branch, nothing logged', () => {
    expect(nextAclsStep(base)).toEqual({
      titleKey: 'algo.title.shockable',
      focus: 'shock',
      ongoingKey: 'algo.ongoing.shockable1',
      steps: [
        { id: 'shock1', key: 'algo.step.shock1', focus: 'shock', state: 'current' },
        { id: 'cpr1', key: 'algo.step.cpr1', focus: 'cpr', state: 'todo' },
        { id: 'shock2', key: 'algo.step.shock2', focus: 'shock', state: 'todo' },
        {
          id: 'epi',
          key: 'algo.step.shockableEpi',
          focus: 'epi',
          state: 'todo',
        },
        { id: 'shock3', key: 'algo.step.shock3', focus: 'shock', state: 'todo' },
        {
          id: 'aa',
          key: 'algo.step.aa',
          focus: 'antiarrhythmic',
          state: 'todo',
        },
      ],
    });
    expect(EN['algo.title.shockable' as MessageKey]).toBe('VF / pulseless VT');
    expect(EN['algo.ongoing.shockable1' as MessageKey]).toBe(
      'Shock at every 2-min check while VF/pVT persists · Epi every 3–5 min · ' +
        'Amiodarone 150 mg (or Lidocaine 0.5–0.75 mg/kg q5–10 min, max 3 mg/kg) 2nd dose.',
    );
  });

  it('shockable branch mid-script (2 shocks, 1 epi)', () => {
    const v = nextAclsStep({ ...base, shocks: 2, epi: 1 });
    expect(v.steps.map((s) => [s.id, s.state])).toEqual([
      ['shock1', 'done'],
      ['cpr1', 'done'],
      ['shock2', 'done'],
      ['epi', 'done'],
      ['shock3', 'current'],
      ['aa', 'todo'],
    ]);
    expect(v.focus).toBe('shock');
  });

  it('shockable branch completed (ongoing switches after 2 antiarrhythmics)', () => {
    const one = nextAclsStep({ ...base, shocks: 3, epi: 1, antiarrhythmic: 1 });
    expect(EN[one.ongoingKey as MessageKey]).toBe(
      'Shock at every 2-min check while VF/pVT persists · Epi every 3–5 min · ' +
        'Amiodarone 150 mg (or Lidocaine 0.5–0.75 mg/kg q5–10 min, max 3 mg/kg) 2nd dose.',
    );
    const two = nextAclsStep({ ...base, shocks: 3, epi: 1, antiarrhythmic: 2 });
    expect(two).toEqual({
      titleKey: 'algo.title.shockable',
      focus: null,
      ongoingKey: 'algo.ongoing.shockable2',
      steps: expect.arrayContaining([
        expect.objectContaining({ id: 'aa', state: 'done' }),
      ]),
    });
    expect(EN['algo.ongoing.shockable2' as MessageKey]).toBe(
      'Shock at every 2-min check while VF/pVT persists · Epi every 3–5 min · treat H’s & T’s.',
    );
  });

  it('non-shockable branch', () => {
    const ns: AlgorithmInput = { ...base, branch: 'nonshockable' };
    expect(nextAclsStep(ns)).toEqual({
      titleKey: 'algo.title.nonshockable',
      focus: 'epi',
      ongoingKey: 'algo.ongoing.nonshockable',
      steps: [
        { id: 'epi', key: 'algo.step.nonshockableEpi', focus: 'epi', state: 'current' },
        {
          id: 'access',
          key: 'algo.step.access',
          focus: 'cpr',
          state: 'todo',
        },
        { id: 'causes', key: 'algo.step.causes', focus: 'causes', state: 'todo' },
      ],
    });
    expect(EN['algo.title.nonshockable' as MessageKey]).toBe('Asystole / PEA');
    expect(EN['algo.ongoing.nonshockable' as MessageKey]).toBe(
      'CPR 2 min → recheck rhythm · Epi every 3–5 min · if shockable, switch branch and shock.',
    );
    expect(nextAclsStep({ ...ns, epi: 1 }).steps.map((s) => [s.id, s.state])).toEqual([
      ['epi', 'done'],
      ['access', 'done'],
      ['causes', 'current'],
    ]);
  });
});

describe('golden: adult clinical content data', () => {
  it('post-ROSC bundle is exactly 8 items in this order, with critical flags', () => {
    expect(POST_ROSC_BUNDLE.map((b) => [b.id, b.critical ?? false])).toEqual([
      ['airway', true],
      ['bp', true],
      ['ecg', true],
      ['neuro', false],
      ['glucose', false],
      ['cause', false],
      ['vitals', false],
      ['icu', false],
    ]);
    expect(POST_ROSC_BUNDLE[0].text).toBe(
      'Optimise ventilation & oxygenation — ETT if not yet placed; SpO₂ 92–98%; avoid hyperventilation',
    );
    expect(POST_ROSC_BUNDLE[1].text).toBe(
      'Hypotension (SBP < 90): IV fluid up to 2 L, then Dopamine 5–10 mcg/kg/min (or norepinephrine / epinephrine infusion); target MAP ≥ 65',
    );
  });

  it('the 11 H’s & T’s keep their id order (SHA Table 3.4)', () => {
    expect(CAUSES.map((c) => c.id)).toEqual([
      'hypoxia',
      'hypovolemia',
      'hypothermia',
      'hydrogen_ion',
      'hypo_hyperkalemia',
      'hypoglycemia',
      'tension_ptx',
      'tamponade',
      'toxins',
      'thrombosis_pulmonary',
      'thrombosis_coronary',
    ]);
  });

  it('the 5 POCUS views keep their id order', () => {
    expect(POCUS_ITEMS.map((p) => p.id)).toEqual(['effusion', 'rv_strain', 'contractility', 'standstill', 'lung_sliding']);
  });
});
