import { describe, it, expect } from 'vitest';
import { stepperValue, stepKg, STEPPER_DEFAULT_KG } from './weightStepper';

describe('weight stepper value', () => {
  it('starts from the weight already set on the code, not a fixed 15 kg', () => {
    expect(stepperValue(null, 7)).toBe(7);
    expect(stepperValue(null, 5.5)).toBe(5.5);
  });

  it('falls back to the default only when no weight is set', () => {
    expect(stepperValue(null, null)).toBe(STEPPER_DEFAULT_KG);
    expect(STEPPER_DEFAULT_KG).toBe(15);
  });

  it('a manual stepper edit wins over the stored weight until committed', () => {
    expect(stepperValue(9, 7)).toBe(9);
  });
});

describe('weight stepper step', () => {
  it('steps 1 kg at 10 kg and above', () => {
    expect(stepKg(15, 1)).toBe(16);
    expect(stepKg(15, -1)).toBe(14);
    expect(stepKg(10, 1)).toBe(11);
  });

  it('steps 0.5 kg below 10 kg so small infants are reachable exactly', () => {
    expect(stepKg(5.5, 1)).toBe(6);
    expect(stepKg(5.5, -1)).toBe(5);
    expect(stepKg(3, -1)).toBe(2.5);
    expect(stepKg(9.5, 1)).toBe(10);
  });

  it('stepping down from 10 kg goes to 9.5 (no jump to 9)', () => {
    expect(stepKg(10, -1)).toBe(9.5);
  });

  it('clamps to 0.5–150 kg with no float drift', () => {
    expect(stepKg(0.5, -1)).toBe(0.5);
    expect(stepKg(1, -1)).toBe(0.5);
    expect(stepKg(150, 1)).toBe(150);
    expect(stepKg(0.7 + 0.1, 1)).toBe(1.3);
  });
});
