/** Pure arithmetic for the pediatric weight card's kg stepper (kept out of the component so it is testable). */

export const STEPPER_DEFAULT_KG = 15;
const MIN_KG = 0.5;
const MAX_KG = 150;

/**
 * The kg the stepper shows: a manual edit if there is one, otherwise the weight already set on
 * the code, otherwise the default. Seeding from the stored weight matters mid-code — tapping the
 * centre button must not silently re-price every dose at a stale 15 kg.
 */
export function stepperValue(draft: number | null, weightKg: number | null): number {
  return draft ?? weightKg ?? STEPPER_DEFAULT_KG;
}

/** One stepper tap: 0.5 kg steps at or below 10 kg (infants), 1 kg above; clamped, float-safe. */
export function stepKg(kg: number, dir: 1 | -1): number {
  const small = dir === 1 ? kg < 10 : kg <= 10;
  const next = kg + dir * (small ? 0.5 : 1);
  return Math.round(Math.min(MAX_KG, Math.max(MIN_KG, next)) * 10) / 10;
}
