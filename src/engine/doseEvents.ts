/**
 * Audit-trail wording for drug doses, built from a protocol-profile result. Pure (no store, no React)
 * so the adult/pediatric choice lives here once. Keys and params are exactly the ones the store
 * used inline before, so persisted labels, goldens and Arabic rendering are unchanged.
 */
import type { MessageKey } from '../i18n/en';
import { keyed, type KeyedEvent } from '../i18n/enText';
import type {
  AmiodaroneResult,
  EpinephrineResult,
  LidocaineResult,
  MagnesiumResult,
  Population,
} from '../content/profiles';

/** A keyed event plus the logged mg (null when the dose could not be calculated: pediatric, no weight). */
export type DoseLog = KeyedEvent & { mg: number | null };

const withMg = (ev: KeyedEvent, mg: number | null): DoseLog => ({ ...ev, mg });

/** `n` = 1-based dose number. `kg` = dosing weight shown in the detail (adult falls back to the 70 kg default). */
export function epiEvent(population: Population, dose: EpinephrineResult | null, n: number, kg: number): DoseLog {
  if (population === 'adult') return withMg(keyed('ev.epi', undefined, 'ev.epi.detail', { n }), dose?.mg ?? null);
  return dose
    ? withMg(keyed('ev.pedsEpi', { mg: dose.mg }, 'ev.pedsEpi.detail', { n, kg }), dose.mg)
    : withMg(keyed('ev.pedsEpi.noWeight', undefined, 'ev.pedsEpi.noWeight.detail', { n }), null);
}

/** `doseIndex` = 0-based count of amiodarone doses already given. */
export function amioEvent(dose: AmiodaroneResult | null, doseIndex: number): DoseLog {
  if (!dose) return withMg(keyed('ev.pedsAmio.noWeight'), null); // adult always has a dose; only pediatric can lack a weight
  const detailKey: MessageKey = doseIndex === 0 ? 'ev.dose.first' : doseIndex === 1 ? 'ev.dose.second' : 'ev.dose.additional';
  return withMg(keyed('ev.amio', { mg: dose.mg }, detailKey), dose.mg);
}

/** `n` = 1-based dose number (pediatric detail); adult takes its dose number from the result. */
export function lidoEvent(population: Population, dose: LidocaineResult | null, n: number, kg: number): DoseLog {
  if (population === 'pediatric') {
    return dose
      ? withMg(keyed('ev.pedsLido', { mg: dose.mg }, 'ev.pedsLido.detail', { n, kg }), dose.mg)
      : withMg(keyed('ev.pedsLido.noWeight'), null);
  }
  // Adult lidocaine always has a result (null weight → 70 kg default inside the profile).
  const d = dose as LidocaineResult;
  return withMg(
    keyed('ev.lido', { minMg: d.mg, maxMg: d.mgMax ?? d.mg }, d.exceedsTotal ? 'ev.lido.detailExceeds' : 'ev.lido.detail', {
      n: d.doseNo ?? n,
      perKg: d.perKgLabel ?? '',
      kg,
      cumMg: d.cumulativeMg ?? d.mg,
      maxMg: d.maxTotalMg ?? 0,
    }),
    d.mg,
  );
}

/** Magnesium keeps no dose list, so only the event text is returned. */
export function magEvent(population: Population, dose: MagnesiumResult | null): KeyedEvent {
  if (population === 'adult') return keyed('ev.mag', undefined, 'ev.mag.detail');
  return dose ? keyed('ev.pedsMag', { minMg: dose.minMg, maxMg: dose.maxMg }) : keyed('ev.pedsMag.noWeight');
}
