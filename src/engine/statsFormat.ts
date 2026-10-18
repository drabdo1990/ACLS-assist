/** Single source of truth for how statistics read — used by the UI panel AND the SBAR so they never disagree. */
import type { CodeStats, Outcome } from './stats';
import { formatClock } from './timing';
import { CAUSES } from '../content/causes';
import { POCUS_ITEMS } from '../content/pocus';

import type { Lang } from '../i18n/lang';
import { translate, hasKey } from '../i18n/translate';
import type { MessageKey } from '../i18n/en';
import { ltr } from '../i18n/format';

export interface StatRow {
  label: string;
  value: string;
  /** neutral fact worth a second look (e.g. epi interval over 5:00) */
  flag?: boolean;
}

export function outcomeLabel(o: Outcome, lang: Lang = 'en'): string {
  return translate(lang, `outcome.${o}` as MessageKey);
}

export function statsTimeNote(lang: Lang = 'en'): string {
  return translate(lang, 'stats.timeNote');
}

const DASH = '—';

export function statsRows(st: CodeStats, lang: Lang = 'en'): StatRow[] {
  const isAr = lang === 'ar';
  const time = (ms: number | null) => (ms == null ? DASH : isAr ? ltr(formatClock(ms)) : formatClock(ms));
  const listOr = (items: string[]) => (items.length ? items.join(isAr ? '، ' : ', ') : DASH);

  const outcomeText =
    outcomeLabel(st.outcome, lang) +
    (st.roscCount > 1 ? translate(lang, 'stats.episodes', { count: st.roscCount }) : '');

  const firstEpiVal =
    st.firstEpiMs == null
      ? DASH
      : `${time(st.firstEpiMs)}${
          st.branchAtFirstEpi
            ? translate(lang, 'stats.firstEpi.branch', {
                branch: translate(
                  lang,
                  `stats.branch.${st.branchAtFirstEpi === 'shockable' ? 'shockable' : 'nonshockable'}` as MessageKey,
                ),
              })
            : ''
        }`;

  const shocksVal = st.shocks.count
    ? `${st.shocks.count} (${st.shocks.joules
        .map((j, i) => {
          const perKg = st.shocks.perKg?.[i];
          return perKg != null ? `${j}J · ${perKg} J/kg` : `${j}J`;
        })
        .join(isAr ? '، ' : ', ')})`
    : '0';

  const notCalculated = (n: number) =>
    n > 0 ? translate(lang, 'stats.notCalculated', { count: n }) : '';

  const amioVal = st.amiodarone.count
    ? `${st.amiodarone.count} (${st.amiodarone.totalMg} mg)${notCalculated(st.amiodarone.notCalculated)}`
    : '0';

  const airwayVal =
    st.airway.type == null
      ? DASH
      : st.airway.type === 'SGA'
        ? translate(lang, 'stats.airway.sga', { time: time(st.airway.firstPlacedMs) })
        : translate(lang, 'stats.airway.ett', { time: time(st.airway.firstPlacedMs) });

  const rhythmsVal = listOr(
    st.rhythms.map((r) => {
      const k = `rhythm.${r}`;
      return hasKey(k) ? translate(lang, k as MessageKey) : r;
    }),
  );

  const causesVal = listOr(
    CAUSES.filter((c) => st.causes.includes(c.id)).map((c) => translate(lang, `cause.${c.id}.label` as MessageKey)),
  );

  const pocusVal = listOr(
    POCUS_ITEMS.filter((p) => st.pocus.includes(p.id)).map((p) => translate(lang, `pocus.${p.id}.label` as MessageKey)),
  );

  const postRoscVal = st.postRosc
    ? translate(lang, 'stats.postRosc.recorded', { done: st.postRosc.done, total: st.postRosc.total })
    : DASH;

  const weightVal =
    st.weightKg == null
      ? DASH
      : st.weightSource === 'estimated'
        ? st.ageMonths != null && st.ageMonths < 12
          ? translate(lang, 'stats.weight.estimatedMonths', { kg: st.weightKg, months: st.ageMonths })
          : translate(lang, 'stats.weight.estimated', { kg: st.weightKg, years: st.ageMonths != null ? st.ageMonths / 12 : 0 })
        : translate(lang, 'stats.weight.measured', { kg: st.weightKg });

  const rows: StatRow[] = [{ label: translate(lang, 'stats.outcome'), value: outcomeText }];
  if (st.population === 'pediatric') {
    rows.push({ label: translate(lang, 'stats.population'), value: translate(lang, 'stats.pop.pediatric') });
    rows.push({ label: translate(lang, 'stats.weight'), value: weightVal });
  }
  rows.push(
    { label: translate(lang, 'stats.arrestTime'), value: time(st.arrestMs) },
    { label: translate(lang, 'stats.firstRosc'), value: time(st.firstRoscMs) },
    { label: translate(lang, 'stats.firstShock'), value: time(st.firstShockMs) },
    { label: translate(lang, 'stats.firstEpi'), value: firstEpiVal },
    { label: translate(lang, 'stats.shocks'), value: shocksVal },
    {
      label: translate(lang, 'stats.epiDoses'),
      value: `${st.epi.count}${notCalculated(st.epi.notCalculated)}`,
    },
    {
      label: translate(lang, 'stats.epiInterval'),
      value: st.epi.meanIntervalMs == null ? DASH : `${time(st.epi.meanIntervalMs)} / ${time(st.epi.longestIntervalMs)}`,
      flag: st.epi.longestExceedsThreshold,
    },
    { label: translate(lang, 'stats.amiodarone'), value: amioVal },
    { label: translate(lang, 'stats.lidoDoses'), value: `${st.lidocaine.count}${notCalculated(st.lidocaine.notCalculated)}` },
    { label: translate(lang, 'stats.magDoses'), value: `${st.magnesium.count}${notCalculated(st.magnesium.notCalculated)}` },
    { label: translate(lang, 'stats.cycles'), value: String(st.cycles) },
    { label: translate(lang, 'stats.pausedTime'), value: time(st.pausedMs) },
    { label: translate(lang, 'stats.airway'), value: airwayVal },
    { label: translate(lang, 'stats.rhythms'), value: rhythmsVal },
    { label: translate(lang, 'stats.causes'), value: causesVal },
    { label: translate(lang, 'stats.pocus'), value: pocusVal },
    { label: translate(lang, 'stats.postRosc'), value: postRoscVal },
  );
  return rows;
}
