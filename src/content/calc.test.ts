import { describe, it, expect } from 'vitest';
import {
  lastLipidPlan,
  lipidCumulative,
  dantrolenePlan,
  ryanodexPlan,
  sugammadexPlan,
  epiLastBolusCeilingMcg,
} from './calc';

describe('LAST 20% lipid emulsion', () => {
  it('scales the bolus at 1.5 mL/kg when below the 100 mL ceiling', () => {
    const p = lastLipidPlan(60);
    expect(p.bolusMl).toBe(90);
    expect(p.bolusCapped).toBe(false);
  });

  it('caps the bolus at 100 mL per protocol (1.5 mL/kg = 105 mL at 70 kg)', () => {
    const p = lastLipidPlan(70);
    expect(p.bolusCapped).toBe(true);
    expect(p.bolusMl).toBe(100);
  });

  it('caps the bolus at 100 mL for large patients', () => {
    const p = lastLipidPlan(110);
    expect(p.bolusCapped).toBe(true);
    expect(p.bolusMl).toBe(100);
  });

  it('gives 0.25 mL/kg/min infusion, doubling to 0.5 for hypotension', () => {
    const p = lastLipidPlan(80);
    expect(p.infusionMlPerMin).toBe(20);
    expect(p.infusionMaxMlPerMin).toBe(40);
  });

  it('computes the 12 mL/kg cumulative ceiling', () => {
    expect(lastLipidPlan(70).cumulativeCapMl).toBe(840);
    expect(lastLipidPlan(100).cumulativeCapMl).toBe(1200);
  });
});

describe('lipid cumulative tracking', () => {
  it('reports percent of cap and flags exceeding it', () => {
    const under = lipidCumulative(70, 400); // cap 840
    expect(under.pctOfCap).toBeCloseTo(400 / 840, 5);
    expect(under.exceeded).toBe(false);

    const over = lipidCumulative(70, 900);
    expect(over.exceeded).toBe(true);
    expect(over.pctOfCap).toBeCloseTo(900 / 840, 5);

    // bar fill is clamped at 1.5× so the progress UI never overflows
    expect(lipidCumulative(70, 1400).pctOfCap).toBe(1.5);
  });
});

describe('malignant hyperthermia — dantrolene', () => {
  it('2.5 mg/kg with 20 mg vials rounded up', () => {
    const p = dantrolenePlan(70); // 175 mg target
    expect(p.doseMg).toBe(175);
    expect(p.vials20).toBe(9); // ceil(8.75)
    expect(p.reconTotalMg).toBe(180);
  });

  it('uses 60 mL sterile water per vial (0.333 mg/mL) and reports admin volume', () => {
    const p = dantrolenePlan(70);
    expect(p.reconVolumeMl).toBe(540);
    expect(p.concentrationMgPerMl).toBeCloseTo(0.333, 3);
    // 175 mg at 0.333 mg/mL ≈ 525 mL
    expect(p.adminVolumeMl).toBe(525);
  });

  it('handles small patients (never zero vials)', () => {
    expect(dantrolenePlan(20).vials20).toBe(3); // 50 mg / 20 = 2.5 -> 3
  });

  it('Ryanodex uses 250 mg single vials at 50 mg/mL', () => {
    const p = ryanodexPlan(70); // 175 mg
    expect(p.doseMg).toBe(175);
    expect(p.vials).toBe(1);
    expect(p.concentrationMgPerMl).toBe(50);
    expect(p.volumeMl).toBe(3.5);
    // a 120 kg patient needs more than one 250 mg vial
    expect(ryanodexPlan(120).vials).toBe(2);
  });
});

describe('CICO sugammadex rescue', () => {
  it('16 mg/kg, 100 mg/mL, with 200 mg vials', () => {
    const p = sugammadexPlan(70);
    expect(p.doseMg).toBe(1120);
    expect(p.volumeMl).toBe(11.2);
    expect(p.vials200).toBe(6);
  });
});

describe('LAST epinephrine caution', () => {
  it('caps individual epi boluses below 1 mcg/kg', () => {
    expect(epiLastBolusCeilingMcg(70)).toBe(70);
    expect(epiLastBolusCeilingMcg(55.6)).toBe(55);
  });
});
