import { describe, it, expect } from 'vitest';
import { profileFor } from '../../content/profiles';
import { appliedPerKg, chosenShock, defaultShockChip, pediatricShockChips } from './shockChips';

const peds = profileFor('pediatric');

describe('pediatric shock chips', () => {
  it('lists 2 J/kg, 4 J/kg and the escalated ≤ 10 J/kg energy for the weight', () => {
    const chips = pediatricShockChips(peds, 10);
    expect(chips.map((c) => c.key)).toEqual(['peds.grid.shock.chip2', 'peds.grid.shock.chip4', 'peds.grid.shock.escalate']);
    expect(chips.map((c) => c.energy.joules)).toEqual([20, 40, 100]);
  });

  it('is empty when no valid weight is set', () => {
    expect(pediatricShockChips(peds, null)).toEqual([]);
  });

  it('defaults to 2 J/kg for the first shock and 4 J/kg afterwards', () => {
    expect(defaultShockChip(0)).toBe(0);
    expect(defaultShockChip(1)).toBe(1);
    expect(defaultShockChip(3)).toBe(1);
  });
});

describe('the energy delivered is the chip the clinician sees selected', () => {
  const chips = pediatricShockChips(peds, 10);

  it('follows the algorithm default when nothing was tapped', () => {
    expect(chosenShock(chips, null, 0)!.energy.joules).toBe(20);
    expect(chosenShock(chips, null, 1)!.energy.joules).toBe(40);
  });

  it('delivers the escalated energy when Escalate is tapped before shock 1 (was forced to 2 J/kg)', () => {
    expect(chosenShock(chips, 2, 0)!.energy.joules).toBe(100);
  });

  it('delivers 2 J/kg when that chip is tapped after shock 1 (was forced to 4 J/kg)', () => {
    expect(chosenShock(chips, 0, 2)!.energy.joules).toBe(20);
  });

  it('delivers 4 J/kg when that chip is tapped before shock 1 (was ignored)', () => {
    expect(chosenShock(chips, 1, 0)!.energy.joules).toBe(40);
  });

  it('returns null with no chips', () => {
    expect(chosenShock([], null, 0)).toBeNull();
  });
});

describe('logged J/kg is what was actually applied', () => {
  it('equals the nominal rate when not capped', () => {
    const e = chosenShock(pediatricShockChips(peds, 10), 1, 0)!.energy;
    expect(appliedPerKg(e, 10)).toBe(4);
  });

  it('is the real J/kg when the 200 J ceiling capped it (60 kg × 4 = 240 → 200 J = 3.3 J/kg)', () => {
    const e = chosenShock(pediatricShockChips(peds, 60), 1, 1)!.energy;
    expect(e.joules).toBe(200);
    expect(e.capped).toBe(true);
    expect(appliedPerKg(e, 60)).toBe(3.3);
  });
});
