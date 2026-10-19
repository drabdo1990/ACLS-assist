/**
 * Protocol profiles — phase 4a. One HUD reads an adult or pediatric profile module, so
 * there are no duplicated screens. `adult.ts` wraps today's adult values with **no value
 * changes** (the golden suites in `content/adult.golden.test.ts` and `engine/eventKeys.test.ts`
 * prove it); `pediatric.ts` holds every pediatric value and is the single file a clinician
 * reviews before `PEDIATRIC_CLINICAL_REVIEWED` flips to true (spec §6/§10).
 *
 * Every dose/energy function takes `weightKg: number | null` and returns `null` when the
 * weight is missing or invalid — the UI then shows "Set weight". Functions never return NaN.
 */
import type { WaveformType } from '../../engine/types';
import type { ChecklistItem } from '../protocols';
import type { AlgorithmInput, AlgorithmView } from '../algorithm';
import type { MessageKey } from '../../i18n/en';

export type Population = 'adult' | 'pediatric';

export type WeightSource = 'measured' | 'estimated' | null;

export interface EpinephrineResult {
  mg: number;
  /** Volume of the 0.1 mg/mL concentration (adult: 1 mg = 10 mL). */
  mL: number;
  /** mg/kg wording, or null when the dose is not weight-based (adult). */
  perKgLabel: string | null;
  capped: boolean;
}

export interface ShockEnergyResult {
  joules: number;
  /** J/kg actually applied, or null when not weight-based (adult). */
  perKg: number | null;
  capped: boolean;
  waveform: WaveformType;
}

export interface AmiodaroneResult {
  mg: number;
  /** true when the per-dose ceiling reduced the calculated dose. */
  capped: boolean;
  /** true when the cumulative dose exceeds the total mg/kg ceiling. */
  exceedsTotal: boolean;
}

export interface LidocaineResult {
  /** Canonical dose: the adult loading/repeat range minimum; the pediatric calculated dose. */
  mg: number;
  /** Adult range maximum (adult only). */
  mgMax?: number;
  perKgLabel?: string;
  capped: boolean;
  /** true when the cumulative dose exceeds the total mg/kg ceiling. */
  exceedsTotal: boolean;
  /** Adult only: 1-based dose number, cumulative mg including this dose, and the 3 mg/kg ceiling. */
  doseNo?: number;
  cumulativeMg?: number;
  maxTotalMg?: number;
}

export interface MagnesiumResult {
  minMg: number;
  maxMg: number;
  capped: boolean;
}

export interface CprProfile {
  ratioKey: MessageKey;
  depthKey: MessageKey;
  rateKey: MessageKey;
}

export interface ProtocolProfile {
  population: Population;
  epinephrine(weightKg: number | null, doseIndex: number): EpinephrineResult | null;
  shockEnergy(weightKg: number | null, shockIndex: number, escalate?: boolean): ShockEnergyResult | null;
  /** Fixed chip list where energy selection is not weight-derived (adult). */
  shockEnergies?: ReadonlyArray<{ joules: number; waveform: WaveformType }>;
  /** `givenMg` = doses already logged (both adult and pediatric cumulative rules use it). */
  amiodarone(weightKg: number | null, doseIndex: number, givenMg: readonly number[]): AmiodaroneResult | null;
  lidocaine(weightKg: number | null, doseIndex: number, givenMg: readonly number[]): LidocaineResult | null;
  magnesium(weightKg: number | null): MagnesiumResult | null;
  cpr: CprProfile;
  ventilationWithAirwayKey: MessageKey;
  algorithm(input: AlgorithmInput): AlgorithmView;
  postRoscBundle: ChecklistItem[];
}

import { adultProfile } from './adult';
import { pediatricProfile } from './pediatric';

/**
 * Clinical sign-off gate (spec §10): every pediatric value in `pediatric.ts` is benchmarked
 * against the SHA PALS Provider Course (`docs/sha-pals-provider-course.md`, mapped in
 * `docs/clinical-benchmark.md`). While false, the UI shows the persistent preview notice on
 * the idle screen and the header badge.
 *
 * Set to true on 2026-10-17 on the owner's instruction: benchmarked to the SHA PALS Provider
 * Course & SHA ACLS Provider Manual 2024. The Arabic pediatric wording is a separate gate and
 * stays marked "draft — clinician review required".
 */
export const PEDIATRIC_CLINICAL_REVIEWED = true;

/** One router for the whole HUD — screens never import a profile directly. */
export function profileFor(population: Population): ProtocolProfile {
  return population === 'pediatric' ? pediatricProfile : adultProfile;
}

