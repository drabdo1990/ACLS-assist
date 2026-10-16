/**
 * Pediatric clinical profile — SHA PALS (AHA PALS 2020/2023 figures, the basis of SHA PALS).
 *
 * ⚠ CLINICAL SIGN-OFF REQUIRED (spec §10): every value in this file is a sign-off row of
 * spec §6 until a clinician verifies it against the hospital's SHA PALS edition. While
 * `PEDIATRIC_CLINICAL_REVIEWED = false` the UI shows the preview notice.
 *
 * Contract: every calculator takes `weightKg: number | null` and returns `null` when the
 * weight is missing or invalid (null, NaN, ≤ 0, > 150) — the UI then shows "Set weight".
 * Functions never return NaN. Rounding: mg → 2 decimals, mL → 1 decimal, joules → whole.
 * `capped` is true when a ceiling applies at this weight (the value shows "(max)").
 */
import type { AlgorithmInput, AlgorithmStep, AlgorithmView, StepFocus } from '../algorithm';
import type { ChecklistItem } from '../protocols';
import type { Population, ProtocolProfile } from './index';

/** Valid dosing weight range in kg (session schema validates 0.5–150). */
const MIN_KG = 0;
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
    text: 'Avoid hypotension (SBP < 5th centile for age) — fluids or vasoactives per local protocol',
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
  label: string;
  key: string;
  focus: StepFocus;
  done: (i: AlgorithmInput) => boolean;
}

const SHOCKABLE: StepDef[] = [
  { id: 'shock1', label: 'Shock — 2 J/kg', key: 'p.algo.step.shock1', focus: 'shock', done: (i) => i.shocks >= 1 },
  { id: 'cpr1', label: 'CPR 2 min · IV/IO access', key: 'algo.step.cpr1', focus: 'cpr', done: (i) => i.shocks >= 2 || i.epi >= 1 },
  { id: 'shock2', label: 'Shock — 4 J/kg', key: 'p.algo.step.shock2', focus: 'shock', done: (i) => i.shocks >= 2 },
  {
    id: 'epi',
    label: 'CPR 2 min + Epinephrine 0.01 mg/kg · consider advanced airway',
    key: 'p.algo.step.epi',
    focus: 'epi',
    done: (i) => i.epi >= 1,
  },
  { id: 'shock3', label: 'Shock — ≥ 4 J/kg', key: 'p.algo.step.shock3', focus: 'shock', done: (i) => i.shocks >= 3 },
  {
    id: 'aa',
    label: 'CPR 2 min + Amiodarone 5 mg/kg or Lidocaine 1 mg/kg · treat H’s & T’s',
    key: 'p.algo.step.aa',
    focus: 'antiarrhythmic',
    done: (i) => i.antiarrhythmic >= 1,
  },
];

const NONSHOCKABLE: StepDef[] = [
  {
    id: 'epi',
    label: 'CPR 2 min + Epinephrine 0.01 mg/kg ASAP',
    key: 'p.algo.step.nonshockableEpi',
    focus: 'epi',
    done: (i) => i.epi >= 1,
  },
  { id: 'access', label: 'IV/IO + advanced airway + capnography', key: 'p.algo.step.access', focus: 'cpr', done: (i) => i.epi >= 1 },
  { id: 'causes', label: 'Identify reversible causes (H’s & T’s)', key: 'algo.step.causes', focus: 'causes', done: (i) => i.causesChecked >= 1 },
];

function buildView(input: AlgorithmInput, defs: StepDef[], title: string, titleKey: string, ongoing: string, ongoingKey: string): AlgorithmView {
  let currentAssigned = false;
  const steps: AlgorithmStep[] = defs.map((d) => {
    const base = { id: d.id, label: d.label, key: d.key, focus: d.focus };
    if (d.done(input)) return { ...base, state: 'done' as const };
    if (!currentAssigned) {
      currentAssigned = true;
      return { ...base, state: 'current' as const };
    }
    return { ...base, state: 'todo' as const };
  });
  return {
    title,
    titleKey,
    steps,
    ongoing,
    ongoingKey,
    focus: steps.find((s) => s.state === 'current')?.focus ?? null,
  };
}

/** Amiodarone: 5 mg/kg per dose, capped at 300 mg; cumulative > 15 mg/kg flagged. */
function amiodaroneResult(kg: number, doseIndex: number) {
  const raw = round2(5 * kg);
  const mg = Math.min(raw, 300);
  let cumulative = 0;
  for (let i = 0; i <= doseIndex; i++) cumulative += Math.min(round2(5 * kg), 300);
  return { mg, capped: raw >= 300, exceedsTotal: cumulative > round2(15 * kg) };
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

  amiodarone: (weightKg, doseIndex) => (valid(weightKg) ? amiodaroneResult(weightKg as number, doseIndex) : null),

  lidocaine: (weightKg) => {
    if (!valid(weightKg)) return null;
    const raw = round2(1 * (weightKg as number));
    return { mg: Math.min(raw, 100), capped: raw >= 100, exceedsTotal: false };
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
        title: 'Select rhythm branch',
        titleKey: 'algo.title.none',
        steps: [],
        ongoing: 'Attach monitor/defibrillator, check rhythm, then choose Shockable or Non-shockable.',
        ongoingKey: 'algo.ongoing.none',
        focus: null,
      };
    }
    return input.branch === 'shockable'
      ? buildView(
          input,
          SHOCKABLE,
          'Pediatric VF / pulseless VT',
          'p.algo.title.shockable',
          'Shock at every 2-min check while VF/pVT persists · Epi every 3–5 min.',
          'p.algo.ongoing.shockable',
        )
      : buildView(
          input,
          NONSHOCKABLE,
          'Pediatric asystole / PEA',
          'p.algo.title.nonshockable',
          'CPR 2 min → recheck rhythm · Epi every 3–5 min.',
          'p.algo.ongoing.nonshockable',
        );
  },

  postRoscBundle: PEDIATRIC_POST_ROSC_BUNDLE as ChecklistItem[],
};

function valid(weightKg: number | null): boolean {
  return typeof weightKg === 'number' && Number.isFinite(weightKg) && weightKg > MIN_KG && weightKg <= MAX_KG;
}
