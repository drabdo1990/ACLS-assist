/**
 * Weight-scaled perioperative crisis dose calculators.
 *
 * All formulas follow the referenced source protocols and are pure functions so
 * they can be unit-tested exhaustively (see calc.test.ts). These are decision
 * SUPPORT figures — the clinician verifies every dose against local protocol.
 *
 * Sources encoded below:
 *  - LAST: ASRA 2020 checklist / 20% lipid emulsion therapy.
 *  - MH:   MHAUS dantrolene dosing (both legacy 20 mg vials and Ryanodex).
 *  - CICO: DAS 2025 extubation/airway failure guidance; sugammadex 16 mg/kg rescue.
 */

export interface DantrolenePlan {
  doseMg: number;
  /** number of 20 mg dantrolene (Dantrium) vials to reconstitute */
  vials20: number;
  /** total mg actually reconstituted once vials are rounded up */
  reconTotalMg: number;
  /** volume of sterile water required (60 mL per 20 mg vial) */
  reconVolumeMl: number;
  /** concentration of the reconstituted solution, mg/mL */
  concentrationMgPerMl: number;
  /** volume of reconstituted solution to administer for the target dose */
  adminVolumeMl: number;
}

export interface RyanodexPlan {
  doseMg: number;
  /** number of 250 mg single-dose vials */
  vials: number;
  /** concentration after reconstitution with 5 mL sterile water (50 mg/mL) */
  concentrationMgPerMl: number;
  /** volume to draw for the target dose */
  volumeMl: number;
}

export interface LipidPlan {
  bolusMl: number;
  /** true when the 100 mL bolus ceiling governed the dose */
  bolusCapped: boolean;
  infusionMlPerMin: number;
  infusionMaxMlPerMin: number;
  /** maximum cumulative 20% lipid dose (12 mL/kg) */
  cumulativeCapMl: number;
  /** bolus interval guidance */
  bolusDurationLabel: string;
}

export interface SugammadexPlan {
  doseMg: number;
  volumeMl: number;
  vials200: number;
}

const LAST_BOLUS_ML_PER_KG = 1.5;
const LAST_BOLUS_CAP_ML = 100;
const LAST_INFUSION_ML_PER_KG_PER_MIN = 0.25;
const LAST_CUMULATIVE_ML_PER_KG = 12;

const DANTROLENE_MG_PER_KG = 2.5;
const DANTROLENE_MG_PER_VIAL = 20;
const DANTROLENE_WATER_ML_PER_VIAL = 60;

const RYANODEX_MG_PER_VIAL = 250;
const RYANODEX_WATER_ML_PER_VIAL = 5;
const RYANODEX_CONCENTRATION = RYANODEX_MG_PER_VIAL / RYANODEX_WATER_ML_PER_VIAL; // 50 mg/mL

const SUGAMMADEX_MG_PER_KG = 16;
const SUGAMMADEX_CONCENTRATION = 100; // Bridion 100 mg/mL

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** 20% lipid emulsion resuscitation plan for LAST. */
export function lastLipidPlan(kg: number): LipidPlan {
  const rawBolus = LAST_BOLUS_ML_PER_KG * kg;
  const capped = rawBolus > LAST_BOLUS_CAP_ML;
  return {
    bolusMl: round(capped ? LAST_BOLUS_CAP_ML : rawBolus, 1),
    bolusCapped: capped,
    infusionMlPerMin: round(LAST_INFUSION_ML_PER_KG_PER_MIN * kg, 2),
    infusionMaxMlPerMin: round(LAST_INFUSION_ML_PER_KG_PER_MIN * 2 * kg, 2),
    cumulativeCapMl: round(LAST_CUMULATIVE_ML_PER_KG * kg, 0),
    bolusDurationLabel: 'over 2–3 min',
  };
}

/** Cumulative 20% lipid given so far, plus whether the 12 mL/kg ceiling is approached/exceeded. */
export function lipidCumulative(
  kg: number,
  adminMl: number,
): { totalMl: number; capMl: number; pctOfCap: number; exceeded: boolean } {
  const capMl = LAST_CUMULATIVE_ML_PER_KG * kg;
  const pct = capMl > 0 ? adminMl / capMl : 0;
  return {
    totalMl: round(adminMl, 0),
    capMl: round(capMl, 0),
    pctOfCap: Math.min(1.5, pct),
    exceeded: adminMl > capMl,
  };
}

/** Legacy dantrolene (20 mg vials) reconstitution plan for malignant hyperthermia. */
export function dantrolenePlan(kg: number): DantrolenePlan {
  const doseMg = DANTROLENE_MG_PER_KG * kg;
  const vials20 = Math.max(1, Math.ceil(doseMg / DANTROLENE_MG_PER_VIAL));
  const reconTotalMg = vials20 * DANTROLENE_MG_PER_VIAL;
  const reconVolumeMl = vials20 * DANTROLENE_WATER_ML_PER_VIAL;
  const concentrationMgPerMl = DANTROLENE_MG_PER_VIAL / DANTROLENE_WATER_ML_PER_VIAL; // 0.333
  return {
    doseMg: round(doseMg, 1),
    vials20,
    reconTotalMg,
    reconVolumeMl,
    concentrationMgPerMl: round(concentrationMgPerMl, 3),
    adminVolumeMl: Math.min(reconVolumeMl, round(doseMg / concentrationMgPerMl, 0)),
  };
}

/** Ryanodex (250 mg single-vial) plan for malignant hyperthermia. */
export function ryanodexPlan(kg: number): RyanodexPlan {
  const doseMg = DANTROLENE_MG_PER_KG * kg;
  return {
    doseMg: round(doseMg, 1),
    vials: Math.max(1, Math.ceil(doseMg / RYANODEX_MG_PER_VIAL)),
    concentrationMgPerMl: RYANODEX_CONCENTRATION,
    volumeMl: round(doseMg / RYANODEX_CONCENTRATION, 1),
  };
}

/** Sugammadex 16 mg/kg immediate rescue dose (CICO / cannot-intubate rescue). */
export function sugammadexPlan(kg: number): SugammadexPlan {
  const doseMg = SUGAMMADEX_MG_PER_KG * kg;
  return {
    doseMg: Math.round(doseMg),
    volumeMl: round(doseMg / SUGAMMADEX_CONCENTRATION, 1),
    vials200: Math.ceil(doseMg / 200),
  };
}

/** Epinephrine ACLS dose reference. */
export const EPINEPHRINE = {
  label: 'Epinephrine',
  dose: '1 mg',
  route: 'IV / IO',
  detail: '1 mg = 10 mL of 1:10,000 (0.1 mg/mL)',
  intervalLabel: 'repeat every 3–5 min',
  /** LAST caution: reduce individual epi boluses to < 1 mcg/kg. */
  lastCaution: '< 1 mcg/kg boluses',
} as const;

export const AMIODARONE = {
  first: 300,
  second: 150,
  label: 'Amiodarone',
  route: 'IV / IO',
  detail: '300 mg first dose → 150 mg second dose',
} as const;

export const DEFAULT_SHOCK_JOULES = [120, 150, 200] as const;

/** Displays weight-dependent epinephrine caution for LAST. */
export function epiLastBolusCeilingMcg(kg: number): number {
  return Math.floor(kg);
}
