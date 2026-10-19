/**
 * The amiodarone / lidocaine button's text and warning state, pure so it is testable in Node
 * (the grid component itself needs a DOM). Adult wording is unchanged; pediatric is weight-based.
 */
import type { ProtocolProfile } from '../../content/profiles';
import type { DoseEvent } from '../../engine/types';
import type { useT } from '../../i18n/useT';

type T = ReturnType<typeof useT>['t'];

export interface AntiarrhythmicText {
  label: string;
  sub: string;
  /** the next dose would pass the cumulative ceiling: the button turns red */
  exceeds: boolean;
}

/** Pediatric amiodarone sub-line: dose ordinal. */
function amioSubPeds(count: number, t: T): string {
  return count === 0 ? t('ev.dose.first') : count === 1 ? t('ev.dose.second') : t('ev.dose.additional');
}

export function antiarrhythmicText(o: {
  profile: ProtocolProfile;
  peds: boolean;
  isLido: boolean;
  weightKg: number | null;
  amio: readonly DoseEvent[];
  lido: readonly DoseEvent[];
  t: T;
}): AntiarrhythmicText {
  const { profile, peds, isLido, weightKg, amio, lido, t } = o;
  const noWeight = peds && weightKg == null;
  // Adult: a null weight falls back to the 70 kg default (pediatric uses its own card).
  const lidoKg = weightKg ?? 70;
  const lidoGivenMg = lido.map((d) => d.mg ?? 0);
  const amioGivenMg = amio.map((d) => d.mg ?? 0);
  // The profile always returns a result for adult; pediatric reads the same value once a weight exists.
  const lidoNext = profile.lidocaine(lidoKg, lido.length, lidoGivenMg)!;
  const lidoGivenTotal = lidoGivenMg.reduce((sum, mg) => sum + mg, 0);
  const pedsAa =
    peds && weightKg != null ? (isLido ? lidoNext : profile.amiodarone(weightKg, amio.length, amioGivenMg)) : null;
  const pedsLidoBudget =
    peds && weightKg != null && isLido ? { givenMg: lidoGivenTotal, maxMg: Math.round(weightKg * 3 * 10) / 10 } : null;
  const pedsLidoExceeds = pedsLidoBudget != null && !!pedsAa?.exceedsTotal;

  const label = peds
    ? noWeight
      ? t('peds.setWeight')
      : isLido
        ? `${t('peds.grid.lido.title', { mg: pedsAa?.mg ?? 0 })}${pedsAa?.capped ? ` ${t('peds.max')}` : ''}`
        : `${t('peds.grid.amio.title', { mg: pedsAa?.mg ?? 0 })}${pedsAa?.capped ? ` ${t('peds.max')}` : ''}`
    : isLido
      ? `Lidocaine ${lidoNext.mg}–${lidoNext.mgMax} mg`
      : `Amiodarone ${profile.amiodarone(weightKg, amio.length, amioGivenMg)?.mg} mg`;

  const count = isLido ? lido.length : amio.length;
  const sub = peds
    ? noWeight
      ? t('peds.setWeightBanner')
      : isLido && pedsLidoBudget
        ? pedsLidoExceeds
          ? t('hud.grid.lido.exceeds', { given: pedsLidoBudget.givenMg, max: pedsLidoBudget.maxMg })
          : amioSubPeds(count, t)
        : !isLido && pedsAa?.exceedsTotal
          ? t('peds.grid.amio.exceeds')
          : amioSubPeds(count, t)
    : isLido
      ? lidoNext.exceedsTotal
        ? t('hud.grid.lido.exceeds', { given: lidoGivenTotal, max: lidoNext.maxTotalMg! })
        : t('hud.grid.lido.sub', {
            n: lido.length + 1,
            perKg: lidoNext.perKgLabel!,
            interval: lido.length ? ' q5–10 min' : '',
            kg: lidoKg,
          })
      : amio.length === 0
        ? t('hud.grid.amio.sub1')
        : amio.length === 1
          ? t('hud.grid.amio.sub2')
          : t('hud.grid.amio.subMax');

  // Pediatric amiodarone's warning shows in the sub-line only, as before.
  const exceeds = isLido && (peds ? pedsLidoExceeds : lidoNext.exceedsTotal);
  return { label, sub, exceeds };
}
