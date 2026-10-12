import { describe, it, expect } from 'vitest';
import {
  SHOCK_ENERGIES,
  amiodaroneDoseMg,
  lidocaineBudget,
  lidocaineDose,
  waveformFor,
  waveformLabel,
} from './calc';

describe('amiodarone sequencing', () => {
  it('300 mg first, then 150 mg', () => {
    expect(amiodaroneDoseMg(0)).toBe(300);
    expect(amiodaroneDoseMg(1)).toBe(150);
    expect(amiodaroneDoseMg(2)).toBe(150);
  });
});

describe('lidocaine dosing', () => {
  it('loading dose is 1–1.5 mg/kg', () => {
    expect(lidocaineDose(70, 0)).toEqual({ doseNo: 1, perKgLabel: '1–1.5 mg/kg', minMg: 70, maxMg: 105 });
  });

  it('repeat doses are 0.5–0.75 mg/kg', () => {
    expect(lidocaineDose(70, 1)).toEqual({ doseNo: 2, perKgLabel: '0.5–0.75 mg/kg', minMg: 35, maxMg: 53 });
    expect(lidocaineDose(80, 2).doseNo).toBe(3);
  });
});

describe('lidocaine 3 mg/kg ceiling (SHA Table 7.1)', () => {
  it('tracks cumulative dose against 3 mg/kg', () => {
    expect(lidocaineBudget(70, [])).toEqual({ givenMg: 0, maxMg: 210, nextExceeds: false });
    // 70 + 35 + 35 + 35 = 175 ≤ 210, the next 35 would reach 210 (not exceed)
    expect(lidocaineBudget(70, [70, 35, 35, 35]).nextExceeds).toBe(false);
    // 70 + 35×4 = 210; any further dose exceeds the ceiling
    expect(lidocaineBudget(70, [70, 35, 35, 35, 35]).nextExceeds).toBe(true);
  });
});

describe('defibrillation energies', () => {
  it('offers biphasic 120/150/200 J and monophasic 360 J', () => {
    expect(SHOCK_ENERGIES.map((e) => e.joules)).toEqual([120, 150, 200, 360]);
    expect(waveformFor(200)).toBe('biphasic');
    expect(waveformFor(360)).toBe('monophasic');
    expect(waveformLabel('monophasic')).toBe('Monophasic');
  });
});
