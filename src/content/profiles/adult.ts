/**
 * Adult protocol profile — wraps today's adult values (content/calc.ts, content/algorithm.ts,
 * content/protocols.ts) behind the ProtocolProfile interface with **no value changes**.
 * A `null` weight is treated as the adult default 70 kg (the lidocaine range uses it);
 * every other adult dose is weight-independent, so `null` changes nothing for them.
 */
import type { AlgorithmInput, AlgorithmView } from '../algorithm';
import { nextAclsStep } from '../algorithm';
import {
  amiodaroneDoseMg,
  lidocaineDose,
  waveformFor,
  SHOCK_ENERGIES,
} from '../calc';
import { POST_ROSC_BUNDLE, type ChecklistItem } from '../protocols';
import type { Population, ProtocolProfile } from './index';

/** Adult default weight: what the store used before phase 4a made weightKg nullable. */
const ADULT_DEFAULT_KG = 70;

export const adultProfile: ProtocolProfile = {
  population: 'adult' as Population,

  epinephrine: () => ({ mg: 1, mL: 10, perKgLabel: null, capped: false }),

  shockEnergy: () => ({ joules: 200, perKg: null, capped: false, waveform: waveformFor(200) }),

  shockEnergies: SHOCK_ENERGIES,

  amiodarone: (_weightKg, doseIndex) => ({
    mg: amiodaroneDoseMg(doseIndex),
    capped: false,
    exceedsTotal: false,
  }),

  lidocaine: (weightKg, doseIndex) => {
    const kg = weightKg ?? ADULT_DEFAULT_KG;
    const d = lidocaineDose(kg, doseIndex);
    return {
      mg: d.minMg,
      mgMax: d.maxMg,
      perKgLabel: d.perKgLabel,
      capped: false,
      exceedsTotal: false,
    };
  },

  magnesium: () => ({ minMg: 1000, maxMg: 2000, capped: false }),

  cpr: {
    ratioKey: 'cpr.adult.ratio',
    depthKey: 'cpr.adult.depth',
    rateKey: 'cpr.adult.rate',
  },

  ventilationWithAirwayKey: 'cpr.adult.airway',

  algorithm: (input: AlgorithmInput): AlgorithmView => nextAclsStep(input),

  postRoscBundle: POST_ROSC_BUNDLE as ChecklistItem[],
};
