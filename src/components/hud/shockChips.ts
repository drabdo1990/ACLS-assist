import type { ProtocolProfile, ShockEnergyResult } from '../../content/profiles';
import type { MessageKey } from '../../i18n/en';

/** One selectable pediatric defibrillation energy (2 J/kg, 4 J/kg, escalated ≤ 10 J/kg). */
export interface ShockChip {
  key: MessageKey;
  energy: ShockEnergyResult;
}

/** The three pediatric energy chips for a weight; empty when the weight is missing or invalid. */
export function pediatricShockChips(profile: ProtocolProfile, weightKg: number | null): ShockChip[] {
  const first = profile.shockEnergy(weightKg, 0, false);
  const repeat = profile.shockEnergy(weightKg, 1, false);
  const escalated = profile.shockEnergy(weightKg, 1, true);
  if (!first || !repeat || !escalated) return [];
  return [
    { key: 'peds.grid.shock.chip2', energy: first },
    { key: 'peds.grid.shock.chip4', energy: repeat },
    { key: 'peds.grid.shock.escalate', energy: escalated },
  ];
}

/** Algorithm default: shock 1 at 2 J/kg, later shocks at 4 J/kg. */
export function defaultShockChip(shockCount: number): 0 | 1 {
  return shockCount < 1 ? 0 : 1;
}

/**
 * The chip that will be delivered: the one the clinician tapped, else the algorithm default.
 * The Deliver button, its label and the highlighted chip must all come from this one value.
 */
export function chosenShock(chips: ShockChip[], tapped: number | null, shockCount: number): ShockChip | null {
  if (!chips.length) return null;
  return chips[tapped ?? defaultShockChip(shockCount)] ?? null;
}

/** J/kg actually applied — the real figure when the 200 J ceiling capped the nominal rate. */
export function appliedPerKg(energy: ShockEnergyResult, weightKg: number): number {
  return energy.capped ? Math.round((energy.joules / weightKg) * 10) / 10 : (energy.perKg ?? 0);
}
