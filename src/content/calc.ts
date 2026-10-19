/**
 * ACLS dose references and pure dose calculators.
 * Benchmark: SHA ACLS Provider Manual 2024, Table 7.1 "Drugs for Resuscitation";
 * consistent with AHA 2020/2023 and ERC 2021.
 *
 * Pure functions so they can be unit-tested exhaustively (see calc.test.ts). These are
 * decision SUPPORT figures — the clinician verifies every dose against local protocol.
 */

import type { WaveformType } from '../engine/types';

/** Epinephrine ACLS dose reference. */
export const EPINEPHRINE = {
  label: 'Epinephrine',
  dose: '1 mg',
  route: 'IV / IO',
  detail: '1 mg = 10 mL of 0.1 mg/mL',
  /** SHA Table 7.1: flush with 20 mL NS and elevate the arm 10–20 s. */
  flush: '20 mL NS flush, elevate arm 10–20 s',
  intervalLabel: 'repeat every 3–5 min',
} as const;

/** Magnesium sulfate for Torsades de pointes (SHA Table 7.1). */
export const MAGNESIUM = {
  label: 'Magnesium sulfate 1–2 g IV/IO',
  indication: 'Torsades de pointes',
} as const;

export const AMIODARONE = {
  first: 300,
  second: 150,
  label: 'Amiodarone',
  route: 'IV / IO',
} as const;

/** Amiodarone dose (mg) for the n-th administration (0-based). */
export function amiodaroneDoseMg(doseIndex: number): number {
  return doseIndex === 0 ? AMIODARONE.first : AMIODARONE.second;
}

export interface LidocaineDose {
  /** 1 = loading dose, 2+ = repeat dose */
  doseNo: number;
  perKgLabel: string;
  minMg: number;
  maxMg: number;
}

/**
 * Lidocaine (replaces amiodarone in VF/pVT): 1–1.5 mg/kg first, then 0.5–0.75 mg/kg
 * every 5–10 min, cumulative max 3 mg/kg (SHA Table 7.1). Rounded to whole mg.
 */
export function lidocaineDose(kg: number, doseIndex: number): LidocaineDose {
  if (doseIndex === 0) {
    return { doseNo: 1, perKgLabel: '1–1.5 mg/kg', minMg: Math.round(kg * 1), maxMg: Math.round(kg * 1.5) };
  }
  return {
    doseNo: doseIndex + 1,
    perKgLabel: '0.5–0.75 mg/kg',
    minMg: Math.round(kg * 0.5),
    maxMg: Math.round(kg * 0.75),
  };
}

export const LIDOCAINE_MAX_MG_PER_KG = 3;

export interface LidocaineBudget {
  givenMg: number;
  maxMg: number;
  /** true when the next dose's lower bound would exceed the 3 mg/kg ceiling */
  nextExceeds: boolean;
}

/** Cumulative lidocaine against the 3 mg/kg ceiling, using the logged (minimum) doses. */
export function lidocaineBudget(kg: number, givenMg: number[]): LidocaineBudget {
  const total = givenMg.reduce((s, mg) => s + mg, 0);
  const maxMg = Math.round(kg * LIDOCAINE_MAX_MG_PER_KG);
  const next = lidocaineDose(kg, givenMg.length).minMg;
  return { givenMg: total, maxMg, nextExceeds: total + next > maxMg };
}

export interface ShockEnergy {
  joules: number;
  waveform: WaveformType;
}

/**
 * Biphasic 120/150/200 J or monophasic 360 J. SHA (Ch. 5): initial and subsequent
 * energy doses follow the defibrillator manufacturer's recommendation.
 */
export const SHOCK_ENERGIES: readonly ShockEnergy[] = [
  { joules: 120, waveform: 'biphasic' },
  { joules: 150, waveform: 'biphasic' },
  { joules: 200, waveform: 'biphasic' },
  { joules: 360, waveform: 'monophasic' },
];

export function waveformFor(joules: number): WaveformType {
  return SHOCK_ENERGIES.find((e) => e.joules === joules)?.waveform ?? 'biphasic';
}
