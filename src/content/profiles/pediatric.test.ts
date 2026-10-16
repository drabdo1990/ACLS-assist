import { describe, it, expect } from 'vitest';
import { AGE_CHIPS, estimateWeightFromAgeMonths, pediatricProfile } from './pediatric';
import { profileFor } from './index';
import type { AlgorithmInput } from '../algorithm';

const peds = pediatricProfile;
const WEIGHTS = [3, 10, 18, 25, 40, 60, 100] as const;

describe('pediatric dose engine — weight table (spec §9)', () => {
  it('epinephrine 0.01 mg/kg = 0.1 mL/kg of 0.1 mg/mL, capped at 1 mg', () => {
    const rows: Record<number, { mg: number; mL: number; capped: boolean }> = {
      3: { mg: 0.03, mL: 0.3, capped: false },
      10: { mg: 0.1, mL: 1, capped: false },
      18: { mg: 0.18, mL: 1.8, capped: false },
      25: { mg: 0.25, mL: 2.5, capped: false },
      40: { mg: 0.4, mL: 4, capped: false },
      60: { mg: 0.6, mL: 6, capped: false },
      100: { mg: 1, mL: 10, capped: true },
    };
    for (const kg of WEIGHTS) {
      expect(peds.epinephrine(kg, 0), `${kg} kg`).toEqual({
        mg: rows[kg].mg,
        mL: rows[kg].mL,
        perKgLabel: '0.01 mg/kg',
        capped: rows[kg].capped,
      });
      // doseIndex is irrelevant: every pediatric epi dose is the same
      expect(peds.epinephrine(kg, 4)).toEqual(peds.epinephrine(kg, 0));
    }
  });

  it('epinephrine mg is exact at infant weights (logged dose = dose calculated), not rounded to 0.01', () => {
    // weights are stored to 0.1 kg; 5.5 kg and 8.5 kg are the 3-month / 9-month APLS estimates
    const rows: Array<[number, number, number]> = [
      //   kg   mg     mL
      [0.5, 0.005, 0.05],
      [1.5, 0.015, 0.15],
      [3.5, 0.035, 0.35],
      [5.5, 0.055, 0.55],
      [8.5, 0.085, 0.85],
    ];
    for (const [kg, mg, mL] of rows) {
      const r = peds.epinephrine(kg, 0)!;
      expect(r.mg, `${kg} kg mg`).toBe(mg);
      expect(r.mL, `${kg} kg mL`).toBe(mL);
    }
  });

  it('shock 1 = 2 J/kg, shock 2 = 4 J/kg, shock 3+ = 4 J/kg (≤ 10 J/kg on escalate), ceiling 200 J', () => {
    const shock: Record<number, [number, number, number]> = {
      //        [shock1 J, shock2 J, escalate J]
      3: [6, 12, 30],
      10: [20, 40, 100],
      18: [36, 72, 180],
      25: [50, 100, 200], // escalate 10 J/kg × 25 = 250 → capped at 200
      40: [80, 160, 200], // escalate capped
      60: [120, 200, 200], // shock2 4×60 = 240 → capped
      100: [200, 200, 200],
    };
    for (const kg of WEIGHTS) {
      const [j1, j2, jEsc] = shock[kg];
      expect(peds.shockEnergy(kg, 0), `${kg} kg shock 1`).toEqual({ joules: j1, perKg: 2, capped: j1 >= 200, waveform: 'biphasic' });
      expect(peds.shockEnergy(kg, 1), `${kg} kg shock 2`).toEqual({
        joules: j2,
        perKg: 4,
        capped: j2 >= 200,
        waveform: 'biphasic',
      });
      expect(peds.shockEnergy(kg, 5), `${kg} kg shock 3+`).toEqual({
        joules: j2,
        perKg: 4,
        capped: j2 >= 200,
        waveform: 'biphasic',
      });
      expect(peds.shockEnergy(kg, 2, true), `${kg} kg escalate`).toEqual({
        joules: jEsc,
        perKg: 10,
        capped: 10 * kg > 200,
        waveform: 'biphasic',
      });
    }
    // capped flag is true exactly when a ceiling reduced the dose
    expect(peds.shockEnergy(60, 1)!.capped).toBe(true);
    expect(peds.shockEnergy(40, 1)!.capped).toBe(false); // 160 < 200
  });

  it('amiodarone 5 mg/kg per dose, capped at 300 mg, cumulative > 15 mg/kg flagged', () => {
    const dose: Record<number, { mg: number; capped: boolean }> = {
      3: { mg: 15, capped: false },
      10: { mg: 50, capped: false },
      18: { mg: 90, capped: false },
      25: { mg: 125, capped: false },
      40: { mg: 200, capped: false },
      60: { mg: 300, capped: true },
      100: { mg: 300, capped: true },
    };
    for (const kg of WEIGHTS) {
      expect(peds.amiodarone(kg, 0), `${kg} kg #1`).toEqual({
        mg: dose[kg].mg,
        capped: dose[kg].capped,
        exceedsTotal: false,
      });
    }
    // cumulative tracking: 3 doses at 5 mg/kg = exactly 15 mg/kg (not exceeded); a 4th dose is
    expect(peds.amiodarone(3, 2)!.exceedsTotal).toBe(false);
    expect(peds.amiodarone(3, 3)!.exceedsTotal).toBe(true);
    // the 300 mg cap keeps the cumulative below 15 mg/kg for big children
    expect(peds.amiodarone(100, 2)!.exceedsTotal).toBe(false);
  });

  it('lidocaine 1 mg/kg loading, capped at 100 mg', () => {
    for (const kg of WEIGHTS) {
      expect(peds.lidocaine(kg, 0), `${kg} kg`).toEqual({
        mg: Math.min(kg, 100),
        capped: kg >= 100,
        exceedsTotal: false,
      });
    }
  });

  it('magnesium 25–50 mg/kg, capped at 2 g', () => {
    const rows: Record<number, [number, number, boolean]> = {
      3: [75, 150, false],
      10: [250, 500, false],
      18: [450, 900, false],
      25: [625, 1250, false],
      40: [1000, 2000, true], // 50×40 = 2000 exactly — the ceiling applies from here ("(max)")
      60: [1500, 2000, true],
      100: [2000, 2000, true],
    };
    for (const kg of WEIGHTS) {
      const [minMg, maxMg, capped] = rows[kg];
      expect(peds.magnesium(kg), `${kg} kg`).toEqual({ minMg, maxMg, capped });
    }
  });

  it('invalid weights (null, 0, negative, > 150, NaN) return null from every calculator', () => {
    for (const w of [null, 0, -5, 151, NaN]) {
      expect(peds.epinephrine(w as never, 0), `epi ${w}`).toBeNull();
      expect(peds.shockEnergy(w as never, 0), `shock ${w}`).toBeNull();
      expect(peds.shockEnergy(w as never, 0, true), `shock esc ${w}`).toBeNull();
      expect(peds.amiodarone(w as never, 0), `amio ${w}`).toBeNull();
      expect(peds.lidocaine(w as never, 0), `lido ${w}`).toBeNull();
      expect(peds.magnesium(w as never), `mag ${w}`).toBeNull();
    }
  });

  it('router returns the pediatric profile', () => {
    expect(profileFor('pediatric')).toBe(peds);
    expect(peds.population).toBe('pediatric');
  });
});

describe('APLS age estimate (spec §6)', () => {
  it('matches the formula band by band', () => {
    expect(estimateWeightFromAgeMonths(0)).toBe(4); // 0.5×0+4
    expect(estimateWeightFromAgeMonths(3)).toBe(5.5);
    expect(estimateWeightFromAgeMonths(6)).toBe(7);
    expect(estimateWeightFromAgeMonths(9)).toBe(8.5);
    expect(estimateWeightFromAgeMonths(12)).toBe(10); // 2×1+8
    expect(estimateWeightFromAgeMonths(30)).toBe(12); // 2×2+8
    expect(estimateWeightFromAgeMonths(60)).toBe(18); // 2×5+8
    expect(estimateWeightFromAgeMonths(71)).toBe(18); // still the 1–5 y band
    expect(estimateWeightFromAgeMonths(72)).toBe(25); // 3×6+7
    expect(estimateWeightFromAgeMonths(96)).toBe(31);
    expect(estimateWeightFromAgeMonths(144)).toBe(43); // 3×12+7
    expect(estimateWeightFromAgeMonths(145)).toBeNull(); // over 12 y: kg entry only
    expect(estimateWeightFromAgeMonths(-1)).toBeNull();
    expect(estimateWeightFromAgeMonths(NaN)).toBeNull();
  });

  it('exposes the age chips: newborn, 3/6/9 m, 1–12 y', () => {
    expect(AGE_CHIPS).toEqual([0, 3, 6, 9, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144]);
    for (const m of AGE_CHIPS) expect(estimateWeightFromAgeMonths(m)).not.toBeNull();
  });
});

describe('pediatric CPR guidance and algorithm (spec §6)', () => {
  it('carries the pediatric CPR / ventilation keys', () => {
    expect(peds.cpr).toEqual({ ratioKey: 'p.cpr.ratio', depthKey: 'p.cpr.depth', rateKey: 'p.cpr.rate' });
    expect(peds.ventilationWithAirwayKey).toBe('p.cpr.airway');
  });

  const base: AlgorithmInput = { branch: 'shockable', shocks: 0, epi: 0, antiarrhythmic: 0, causesChecked: 0 };

  it('shockable script walks shock → CPR → shock → epi → shock → antiarrhythmic', () => {
    const v = peds.algorithm(base);
    expect(v.titleKey).toBe('p.algo.title.shockable');
    expect(v.steps.map((s) => s.id)).toEqual(['shock1', 'cpr1', 'shock2', 'epi', 'shock3', 'aa']);
    expect(v.steps[0]).toMatchObject({ label: 'Shock — 2 J/kg', focus: 'shock', state: 'current' });
    expect(v.steps[2]).toMatchObject({ label: 'Shock — 4 J/kg', focus: 'shock', state: 'todo' });
    expect(v.ongoingKey).toBe('p.algo.ongoing.shockable');
    expect(peds.algorithm({ ...base, shocks: 2, epi: 1 }).steps.find((s) => s.id === 'shock3')!.state).toBe('current');
    const done = peds.algorithm({ ...base, shocks: 3, epi: 1, antiarrhythmic: 1 });
    expect(done.steps.every((s) => s.state === 'done')).toBe(true);
    expect(done.focus).toBeNull();
  });

  it('non-shockable script prioritises epinephrine, then access/airway, then causes', () => {
    const ns: AlgorithmInput = { ...base, branch: 'nonshockable' };
    const v = peds.algorithm(ns);
    expect(v.titleKey).toBe('p.algo.title.nonshockable');
    expect(v.steps.map((s) => s.id)).toEqual(['epi', 'access', 'causes']);
    expect(v.steps[0]).toMatchObject({ label: 'CPR 2 min + Epinephrine 0.01 mg/kg ASAP', focus: 'epi', state: 'current' });
    expect(peds.algorithm({ ...ns, epi: 1 }).steps.find((s) => s.id === 'causes')!.state).toBe('current');
  });

  it('no branch falls back to the shared select-branch view', () => {
    const v = peds.algorithm({ ...base, branch: null });
    expect(v.titleKey).toBe('algo.title.none');
    expect(v.steps).toHaveLength(0);
  });
});

describe('pediatric post-ROSC bundle (spec §6)', () => {
  it('is the 8-item pediatric bundle in order', () => {
    expect(peds.postRoscBundle.map((b) => [b.id, b.critical ?? false])).toEqual([
      ['spo2', true],
      ['co2', true],
      ['bp', true],
      ['temp', false],
      ['glucose', false],
      ['ecg', false],
      ['seizure', false],
      ['picu', false],
    ]);
  });
});
