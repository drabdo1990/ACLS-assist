import { describe, it, expect } from 'vitest';
import { amioEvent, epiEvent, lidoEvent, magEvent } from './doseEvents';
import { profileFor } from '../content/profiles';

const adult = profileFor('adult');
const peds = profileFor('pediatric');

describe('doseEvents — epinephrine', () => {
  it('adult: fixed 1 mg wording, mg 1', () => {
    const e = epiEvent('adult', adult.epinephrine(70, 1), 2, 70);
    expect(e).toMatchObject({ label: 'Epinephrine 1 mg IV/IO', mg: 1, i18n: { key: 'ev.epi', detailKey: 'ev.epi.detail', detailParams: { n: 2 } } });
    expect(e.i18n.params).toBeUndefined();
  });
  it('pediatric: weight-based, and "no weight" logs mg null', () => {
    const e = epiEvent('pediatric', peds.epinephrine(20, 0), 1, 20);
    expect(e).toMatchObject({ label: 'Epinephrine 0.2 mg IV/IO', mg: 0.2, i18n: { key: 'ev.pedsEpi', detailParams: { n: 1, kg: 20 } } });
    const off = epiEvent('pediatric', peds.epinephrine(null, 0), 1, 70);
    expect(off).toMatchObject({ mg: null, i18n: { key: 'ev.pedsEpi.noWeight', detailKey: 'ev.pedsEpi.noWeight.detail', detailParams: { n: 1 } } });
  });
});

describe('doseEvents — amiodarone', () => {
  it('adult: 300 then 150 mg, detail key by dose index', () => {
    const keys = [0, 1, 2].map((i) => amioEvent(adult.amiodarone(70, i, []), i));
    expect(keys.map((k) => [k.label, k.mg, k.i18n.detailKey])).toEqual([
      ['Amiodarone 300 mg IV/IO', 300, 'ev.dose.first'],
      ['Amiodarone 150 mg IV/IO', 150, 'ev.dose.second'],
      ['Amiodarone 150 mg IV/IO', 150, 'ev.dose.additional'],
    ]);
  });
  it('pediatric: 5 mg/kg, and "no weight" has no detail and mg null', () => {
    expect(amioEvent(peds.amiodarone(20, 0, []), 0)).toMatchObject({ label: 'Amiodarone 100 mg IV/IO', mg: 100 });
    const off = amioEvent(peds.amiodarone(null, 0, []), 0);
    expect(off).toMatchObject({ mg: null, detail: undefined, i18n: { key: 'ev.pedsAmio.noWeight' } });
  });
});

describe('doseEvents — lidocaine', () => {
  it('adult: range label, mg = lower bound, plain detail while under 3 mg/kg', () => {
    const e = lidoEvent('adult', adult.lidocaine(70, 0, []), 1, 70);
    expect(e).toMatchObject({
      label: 'Lidocaine 70–105 mg IV/IO',
      mg: 70,
      i18n: { key: 'ev.lido', detailKey: 'ev.lido.detail', detailParams: { n: 1, perKg: '1–1.5 mg/kg', kg: 70, cumMg: 70, maxMg: 210 } },
    });
  });
  it('adult: EXCEEDS wording once the next dose passes 3 mg/kg', () => {
    const given = [70, 35, 35, 35, 35]; // 210 mg = 3 mg/kg at 70 kg
    const e = lidoEvent('adult', adult.lidocaine(70, 5, given), 6, 70);
    expect(e.i18n.detailKey).toBe('ev.lido.detailExceeds');
    expect(e.detail).toContain('EXCEEDS 3 mg/kg');
    expect(e.i18n.detailParams).toMatchObject({ n: 6, cumMg: 245, maxMg: 210 });
  });
  it('adult: null weight uses the 70 kg default', () => {
    expect(lidoEvent('adult', adult.lidocaine(null, 0, []), 1, 70).label).toBe('Lidocaine 70–105 mg IV/IO');
  });
  it('pediatric: 1 mg/kg, and "no weight" logs mg null', () => {
    expect(lidoEvent('pediatric', peds.lidocaine(10, 1, [10]), 2, 10)).toMatchObject({
      label: 'Lidocaine 10 mg IV/IO',
      mg: 10,
      i18n: { key: 'ev.pedsLido', detailKey: 'ev.pedsLido.detail', detailParams: { n: 2, kg: 10 } },
    });
    expect(lidoEvent('pediatric', peds.lidocaine(null, 0, []), 1, 70)).toMatchObject({ mg: null, i18n: { key: 'ev.pedsLido.noWeight' } });
  });
});

describe('doseEvents — magnesium', () => {
  it('adult: fixed wording with indication detail', () => {
    expect(magEvent('adult', adult.magnesium(70))).toMatchObject({
      label: 'Magnesium sulfate 1–2 g IV/IO',
      i18n: { key: 'ev.mag', detailKey: 'ev.mag.detail' },
    });
  });
  it('pediatric: mg/kg range, and "no weight" wording', () => {
    expect(magEvent('pediatric', peds.magnesium(10))).toMatchObject({
      label: 'Magnesium sulfate 250–500 mg IV/IO',
      i18n: { key: 'ev.pedsMag', params: { minMg: 250, maxMg: 500 } },
    });
    expect(magEvent('pediatric', peds.magnesium(null)).i18n.key).toBe('ev.pedsMag.noWeight');
  });
});
