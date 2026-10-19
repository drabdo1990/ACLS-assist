import { describe, it, expect } from 'vitest';
import { profileFor } from './index';
import { amiodaroneDoseMg, lidocaineBudget, lidocaineDose } from '../calc';
import { nextAclsStep, type AlgorithmInput } from '../algorithm';
import { POST_ROSC_BUNDLE } from '../protocols';

const adult = profileFor('adult');

describe('profileFor', () => {
  it('returns the same adult profile instance for repeated calls', () => {
    expect(profileFor('adult')).toBe(adult);
    expect(adult.population).toBe('adult');
  });
});

describe('adult profile — dose engine parity with content/calc.ts', () => {
  it('epinephrine is the fixed 1 mg adult dose (null weight treated as any adult)', () => {
    expect(adult.epinephrine(70, 0)).toEqual({ mg: 1, mL: 10, perKgLabel: null, capped: false });
    expect(adult.epinephrine(null, 3)).toEqual({ mg: 1, mL: 10, perKgLabel: null, capped: false });
  });

  it('shockEnergy pins the adult default (200 J biphasic), never weight-based', () => {
    expect(adult.shockEnergy(70, 0)).toEqual({ joules: 200, perKg: null, capped: false, waveform: 'biphasic' });
    expect(adult.shockEnergy(null, 2, true)).toEqual({ joules: 200, perKg: null, capped: false, waveform: 'biphasic' });
    expect(adult.shockEnergies).toEqual([
      { joules: 120, waveform: 'biphasic' },
      { joules: 150, waveform: 'biphasic' },
      { joules: 200, waveform: 'biphasic' },
      { joules: 360, waveform: 'monophasic' },
    ]);
  });

  it('amiodarone matches amiodaroneDoseMg', () => {
    for (const i of [0, 1, 2, 3]) {
      expect(adult.amiodarone(null, i, [])).toEqual({
        mg: amiodaroneDoseMg(i),
        capped: false,
        exceedsTotal: false,
      });
    }
  });

  it('lidocaine wraps lidocaineDose with a null weight defaulting to 70 kg', () => {
    expect(adult.lidocaine(null, 0, [])).toEqual(adult.lidocaine(70, 0, []));
    expect(adult.lidocaine(null, 0, [])).toEqual({
      mg: 70,
      mgMax: 105,
      perKgLabel: '1–1.5 mg/kg',
      capped: false,
      exceedsTotal: false,
      doseNo: 1,
      cumulativeMg: 70,
      maxTotalMg: 210,
    });
    expect(adult.lidocaine(80, 1, [80])).toEqual({
      mg: 40,
      mgMax: 60,
      perKgLabel: '0.5–0.75 mg/kg',
      capped: false,
      exceedsTotal: false,
      doseNo: 2,
      cumulativeMg: 120,
      maxTotalMg: 240,
    });
  });

  // The store/grid used lidocaineDose + lidocaineBudget directly; the profile must return the same
  // numbers, including the 3 mg/kg warning flipping on (the clinical safety net for the refactor).
  it('lidocaine matches lidocaineDose + lidocaineBudget for dose indexes 0–5, given the logged doses', () => {
    for (const kg of [40, 70, 100]) {
      const given: number[] = [];
      let flipped = false;
      for (let i = 0; i <= 5; i++) {
        const d = lidocaineDose(kg, i);
        const b = lidocaineBudget(kg, given);
        expect(adult.lidocaine(kg, i, given), `${kg} kg #${i + 1}`).toEqual({
          mg: d.minMg,
          mgMax: d.maxMg,
          perKgLabel: d.perKgLabel,
          capped: false,
          exceedsTotal: b.nextExceeds,
          doseNo: d.doseNo,
          cumulativeMg: b.givenMg + d.minMg,
          maxTotalMg: b.maxMg,
        });
        flipped ||= b.nextExceeds;
        given.push(d.minMg);
      }
      expect(flipped, `${kg} kg: warning flips by dose 6`).toBe(true);
    }
  });

  it('magnesium is the fixed 1–2 g adult dose', () => {
    expect(adult.magnesium(null)).toEqual({ minMg: 1000, maxMg: 2000, capped: false });
    expect(adult.magnesium(70)).toEqual({ minMg: 1000, maxMg: 2000, capped: false });
  });
});

describe('adult profile — algorithm and bundle parity', () => {
  const inputs: AlgorithmInput[] = [
    { branch: null, shocks: 0, epi: 0, antiarrhythmic: 0, causesChecked: 0 },
    { branch: 'shockable', shocks: 0, epi: 0, antiarrhythmic: 0, causesChecked: 0 },
    { branch: 'shockable', shocks: 2, epi: 1, antiarrhythmic: 0, causesChecked: 0 },
    { branch: 'shockable', shocks: 3, epi: 1, antiarrhythmic: 2, causesChecked: 0 },
    { branch: 'nonshockable', shocks: 0, epi: 1, antiarrhythmic: 0, causesChecked: 1 },
  ];

  it('algorithm(input) is byte-identical to nextAclsStep', () => {
    for (const input of inputs) expect(adult.algorithm(input)).toEqual(nextAclsStep(input));
  });

  it('postRoscBundle is the unchanged adult bundle', () => {
    expect(adult.postRoscBundle).toEqual(POST_ROSC_BUNDLE);
  });

  it('CPR guidance keys match the adult guidance', () => {
    expect(adult.cpr).toEqual({
      ratioKey: 'cpr.adult.ratio',
      depthKey: 'cpr.adult.depth',
      rateKey: 'cpr.adult.rate',
    });
    expect(adult.ventilationWithAirwayKey).toBe('cpr.adult.airway');
  });
});
