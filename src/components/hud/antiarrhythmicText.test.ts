import { describe, expect, it } from 'vitest';
import { profileFor } from '../../content/profiles';
import { translate } from '../../i18n/translate';
import { antiarrhythmicText } from './antiarrhythmicText';

const t = ((key, params) => translate('en', key, params)) as Parameters<typeof antiarrhythmicText>[0]['t'];
const dose = (mg: number | null) => ({ at: 1, t: 1, label: 'x', mg });

const adult = (o: { isLido?: boolean; amio?: number[]; lido?: number[]; weightKg?: number | null } = {}) =>
  antiarrhythmicText({
    profile: profileFor('adult'),
    peds: false,
    isLido: o.isLido ?? false,
    weightKg: o.weightKg === undefined ? 70 : o.weightKg,
    amio: (o.amio ?? []).map(dose),
    lido: (o.lido ?? []).map(dose),
    t,
  });
const peds = (o: { isLido?: boolean; amio?: number[]; lido?: number[]; weightKg: number | null }) =>
  antiarrhythmicText({
    profile: profileFor('pediatric'),
    peds: true,
    isLido: o.isLido ?? false,
    weightKg: o.weightKg,
    amio: (o.amio ?? []).map(dose),
    lido: (o.lido ?? []).map(dose),
    t,
  });

describe('antiarrhythmicText — adult', () => {
  it('amiodarone: 300 mg, then 150 mg, with the matching sub-line', () => {
    expect(adult()).toMatchObject({ label: 'Amiodarone 300 mg', sub: 'Dose 1 → next 150 mg', exceeds: false });
    expect(adult({ amio: [300] })).toMatchObject({ label: 'Amiodarone 150 mg', sub: 'Dose 2 (final bolus)' });
    expect(adult({ amio: [300, 150] }).sub).toBe('Max 2 boluses given');
  });

  it('lidocaine: weight-based range; null weight uses 70 kg', () => {
    expect(adult({ isLido: true })).toMatchObject({
      label: 'Lidocaine 70–105 mg',
      sub: 'Dose 1 · 1–1.5 mg/kg @ 70 kg',
      exceeds: false,
    });
    expect(adult({ isLido: true, weightKg: null }).label).toBe('Lidocaine 70–105 mg');
    expect(adult({ isLido: true, lido: [70], weightKg: 80 }).sub).toBe('Dose 2 · 0.5–0.75 mg/kg q5–10 min @ 80 kg');
  });

  it('lidocaine: red warning once the next dose would pass 3 mg/kg', () => {
    const r = adult({ isLido: true, lido: [70, 35, 35, 35, 35] });
    expect(r.exceeds).toBe(true);
    expect(r.sub).toBe('⚠ Exceeds 3 mg/kg max (210/210 mg given)');
    expect(adult({ isLido: true, lido: [70, 35, 35, 35] }).exceeds).toBe(false);
  });
});

describe('antiarrhythmicText — pediatric', () => {
  it('weight-based labels, and "Set weight" without a weight', () => {
    expect(peds({ weightKg: 20 }).label).toBe('Amiodarone 100 mg · 5 mg/kg');
    expect(peds({ weightKg: 20, isLido: true }).label).toBe('Lidocaine 20 mg · 1 mg/kg');
    expect(peds({ weightKg: null })).toMatchObject({ label: 'Set weight', exceeds: false });
  });

  it('amiodarone: warns from the doses actually given, e.g. after a weight correction', () => {
    // 100 mg given at 20 kg, weight corrected to 10 kg, 50 mg given: the next 50 mg makes 200 > 150 mg
    expect(peds({ weightKg: 10, amio: [100, 50] }).sub).toBe('⚠ Exceeds 15 mg/kg cumulative max');
    expect(peds({ weightKg: 10, amio: [100] }).sub).not.toContain('Exceeds');
  });

  it('lidocaine: warns when given + next passes 3 mg/kg, and turns the button red', () => {
    expect(peds({ weightKg: 10, isLido: true, lido: [10, 10] })).toMatchObject({ exceeds: false });
    const r = peds({ weightKg: 10, isLido: true, lido: [10, 10, 10] });
    expect(r.exceeds).toBe(true);
    expect(r.sub).toBe('⚠ Exceeds 3 mg/kg max (30/30 mg given)');
  });
});
