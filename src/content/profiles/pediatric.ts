/**
 * Pediatric clinical profile — benchmarked to the SHA Pediatric Advanced Life Support
 * Provider Course (“SHA PALS provider course”, Saudi Heart Association / King Saud University
 * Medical City; see `docs/sha-pals-provider-course.md` and `docs/clinical-benchmark.md`):
 * - CPR & ventilation: Module 4, Ch. 4, Table 4.4.3 (pp. 94–95) & Module 2 (p. 45)
 * - Defibrillation (2 → 4 → 4–10 J/kg, max adult dose): Module 4, Ch. 4 (p. 96)
 * - Epinephrine (0.01 mg/kg = 0.1 mL/kg of 1:10,000 q3–5 min, max 1 mg): Module 4, Table 4.2.2 (p. 75)
 * - Amiodarone (5 mg/kg), Lidocaine (1 mg/kg), Magnesium (25–50 mg/kg): Module 4, Ch. 4–5 (pp. 96, 99)
 * - Post–cardiac arrest care (SpO₂ 94–99%, normocarbia, age-based SBP, TTM, glucose, EEG): Module 4, Ch. 6 (pp. 102–105)
 *
 * Contract: every calculator takes `weightKg: number | null` and returns `null` when the
 * weight is missing or invalid (null, NaN, < 0.5, > 150) — the UI then shows "Set weight".
 * Functions never return NaN. Rounding: mg → 2–3 decimals, mL → 1–2 decimals, joules → whole.
 * `capped` is true when a ceiling applies at this weight (the value shows "(max)").
 */
import type { AlgorithmInput, AlgorithmStep, AlgorithmView, StepFocus } from '../algorithm';
import type { ChecklistItem } from '../protocols';
import type { Population, ProtocolProfile } from './index';

/** Valid dosing weight range in kg (session schema validates 0.5–150). */
const MIN_KG = 0.5;
const MAX_KG = 150;

/** APLS formulas (spec §6). Over 12 years: kg entry only → null. */
export function estimateWeightFromAgeMonths(ageMonths: number): number | null {
  if (!Number.isFinite(ageMonths) || ageMonths < 0) return null;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  if (ageMonths < 12) return r1(0.5 * ageMonths + 4);
  const years = Math.floor(ageMonths / 12);
  if (ageMonths <= 71) return 2 * years + 8;
  if (ageMonths <= 144) return 3 * years + 7;
  return null;
}

/** Idle-screen age chips: newborn, 3/6/9 months, then 1–12 years (in months). */
export const AGE_CHIPS: readonly number[] = [0, 3, 6, 9, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144];

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const round2 = (v: number) => Math.round(v * 100) / 100;

export type PediatricPostRoscId = 'spo2' | 'co2' | 'bp' | 'temp' | 'glucose' | 'ecg' | 'seizure' | 'picu';

export const PEDIATRIC_POST_ROSC_BUNDLE: ChecklistItem<PediatricPostRoscId>[] = [
  { id: 'spo2', text: 'SpO₂ 94–99% — avoid hyperoxia', critical: true },
  { id: 'co2', text: 'Normal CO₂ — check capnography / blood gas', critical: true },
  {
    id: 'bp',
    text: 'Avoid hypotension — SBP < 60 neonate, < 70 infant, < 70 + 2 × age (yr) child, < 90 adolescent — fluids or vasoactives per local protocol',
    critical: true,
  },
  { id: 'temp', text: 'Treat fever; temperature control per local protocol' },
  { id: 'glucose', text: 'Check glucose and correct it' },
  { id: 'ecg', text: '12-lead ECG / echo as indicated' },
  { id: 'seizure', text: 'Monitor and treat seizures' },
  { id: 'picu', text: 'Transfer to PICU; complete the record; team debrief' },
];

interface StepDef {
  id: string;
  key: string;
  focus: StepFocus;
  done: (i: AlgorithmInput) => boolean;
}

const SHOCKABLE: StepDef[] = [
  { id: 'shock1', key: 'p.algo.step.shock1', focus: 'shock', done: (i) => i.shocks >= 1 },
  { id: 'cpr1', key: 'algo.step.cpr1', focus: 'cpr', done: (i) => i.shocks >= 2 || i.epi >= 1 },
  { id: 'shock2', key: 'p.algo.step.shock2', focus: 'shock', done: (i) => i.shocks >= 2 },
  {
    id: 'epi',
    key: 'p.algo.step.epi',
    focus: 'epi',
    done: (i) => i.epi >= 1,
  },
  { id: 'shock3', key: 'p.algo.step.shock3', focus: 'shock', done: (i) => i.shocks >= 3 },
  {
    id: 'aa',
    key: 'p.algo.step.aa',
    focus: 'antiarrhythmic',
    done: (i) => i.antiarrhythmic >= 1,
  },
];

const NONSHOCKABLE: StepDef[] = [
  {
    id: 'epi',
    key: 'p.algo.step.nonshockableEpi',
    focus: 'epi',
    done: (i) => i.epi >= 1,
  },
  { id: 'access', key: 'p.algo.step.access', focus: 'cpr', done: (i) => i.epi >= 1 },
  { id: 'causes', key: 'algo.step.causes', focus: 'causes', done: (i) => i.causesChecked >= 1 },
];

function buildView(input: AlgorithmInput, defs: StepDef[], titleKey: string, ongoingKey: string): AlgorithmView {
  let currentAssigned = false;
  const steps: AlgorithmStep[] = defs.map((d) => {
    const base = { id: d.id, key: d.key, focus: d.focus };
    if (d.done(input)) return { ...base, state: 'done' as const };
    if (!currentAssigned) {
      currentAssigned = true;
      return { ...base, state: 'current' as const };
    }
    return { ...base, state: 'todo' as const };
  });
  return {
    titleKey,
    steps,
    ongoingKey,
    focus: steps.find((s) => s.state === 'current')?.focus ?? null,
  };
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Amiodarone: 5 mg/kg per dose, capped at 300 mg; given + this dose > 15 mg/kg flagged (real logged doses, so a weight correction mid-code is counted). */
function amiodaroneResult(kg: number, givenMg: readonly number[]) {
  const raw = round2(5 * kg);
  const mg = Math.min(raw, 300);
  return { mg, capped: raw >= 300, exceedsTotal: round2(sum(givenMg) + mg) > round2(15 * kg) };
}

export const pediatricProfile: ProtocolProfile = {
  population: 'pediatric' as Population,

  epinephrine: (weightKg) => {
    if (!valid(weightKg)) return null;
    const kg = weightKg as number;
    const raw = 0.01 * kg;
    const capped = raw >= 1;
    // Weights are stored to 0.1 kg, so 0.01 mg/kg is exact to 0.001 mg (and 0.01 mL at 0.1 mg/mL).
    // Rounding to 0.01 mg logged +9% at 5.5 kg and +100% at 0.5 kg — the log must equal the dose given.
    return {
      mg: round3(Math.min(raw, 1)),
      mL: round2(Math.min(raw, 1) * 10),
      perKgLabel: '0.01 mg/kg',
      capped,
    };
  },

  shockEnergy: (weightKg, shockIndex, escalate = false) => {
    if (!valid(weightKg)) return null;
    const kg = weightKg as number;
    const perKgRate = shockIndex < 1 ? 2 : escalate ? 10 : 4;
    const perKg = Math.min(perKgRate, 10);
    const raw = perKg * kg;
    return {
      joules: Math.round(Math.min(raw, 200)),
      perKg,
      capped: raw >= 200,
      waveform: 'biphasic',
    };
  },

  amiodarone: (weightKg, _doseIndex, givenMg) => (valid(weightKg) ? amiodaroneResult(weightKg as number, givenMg) : null),

  lidocaine: (weightKg, _doseIndex, givenMg) => {
    if (!valid(weightKg)) return null;
    const kg = weightKg as number;
    const raw = round2(1 * kg);
    const mg = Math.min(raw, 100);
    // PALS: 1 mg/kg per dose, total 3 mg/kg. Count the doses already logged plus the one about to be given.
    const cumulative = round2(sum(givenMg) + mg);
    return { mg, capped: raw >= 100, exceedsTotal: cumulative > round2(3 * kg) };
  },

  magnesium: (weightKg) => {
    if (!valid(weightKg)) return null;
    const kg = weightKg as number;
    const minRaw = 25 * kg;
    const maxRaw = 50 * kg;
    return {
      minMg: Math.round(Math.min(minRaw, 2000)),
      maxMg: Math.round(Math.min(maxRaw, 2000)),
      capped: maxRaw >= 2000,
    };
  },

  cpr: {
    ratioKey: 'p.cpr.ratio',
    depthKey: 'p.cpr.depth',
    rateKey: 'p.cpr.rate',
  },

  ventilationWithAirwayKey: 'p.cpr.airway',

  algorithm: (input: AlgorithmInput): AlgorithmView => {
    if (input.branch == null) {
      return {
        titleKey: 'algo.title.none',
        steps: [],
        ongoingKey: 'algo.ongoing.none',
        focus: null,
      };
    }
    return input.branch === 'shockable'
      ? buildView(input, SHOCKABLE, 'p.algo.title.shockable', 'p.algo.ongoing.shockable')
      : buildView(input, NONSHOCKABLE, 'p.algo.title.nonshockable', 'p.algo.ongoing.nonshockable');
  },

  postRoscBundle: PEDIATRIC_POST_ROSC_BUNDLE as ChecklistItem[],
};

function valid(weightKg: number | null): boolean {
  return typeof weightKg === 'number' && Number.isFinite(weightKg) && weightKg >= MIN_KG && weightKg <= MAX_KG;
}
