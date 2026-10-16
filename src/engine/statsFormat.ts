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

export const OUTCOME_LABEL: Record<Outcome, string> = {
  rosc: 'ROSC achieved',
  rosc_then_terminated: 'ROSC achieved, later terminated',
  terminated: 'Terminated without ROSC',
  incomplete: 'Incomplete (code not ended)',
};

export function outcomeLabel(o: Outcome, lang: Lang = 'en'): string {
  return translate(lang, `outcome.${o}` as MessageKey);
}

export const STATS_TIME_NOTE = 'Times are from code activation, as logged.';

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
    ? `${st.shocks.count} (${st.shocks.joules.map((j) => `${j}J`).join(isAr ? '، ' : ', ')})`
    : '0';

  const amioVal = st.amiodarone.count ? `${st.amiodarone.count} (${st.amiodarone.totalMg} mg)` : '0';

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

  return [
    { label: translate(lang, 'stats.outcome'), value: outcomeText },
    { label: translate(lang, 'stats.arrestTime'), value: time(st.arrestMs) },
    { label: translate(lang, 'stats.firstRosc'), value: time(st.firstRoscMs) },
    { label: translate(lang, 'stats.firstShock'), value: time(st.firstShockMs) },
    { label: translate(lang, 'stats.firstEpi'), value: firstEpiVal },
    { label: translate(lang, 'stats.shocks'), value: shocksVal },
    { label: translate(lang, 'stats.epiDoses'), value: String(st.epi.count) },
    {
      label: translate(lang, 'stats.epiInterval'),
      value: st.epi.meanIntervalMs == null ? DASH : `${time(st.epi.meanIntervalMs)} / ${time(st.epi.longestIntervalMs)}`,
      flag: st.epi.longestExceedsThreshold,
    },
    { label: translate(lang, 'stats.amiodarone'), value: amioVal },
    { label: translate(lang, 'stats.lidoDoses'), value: String(st.lidocaine.count) },
    { label: translate(lang, 'stats.magDoses'), value: String(st.magnesium.count) },
    { label: translate(lang, 'stats.cycles'), value: String(st.cycles) },
    { label: translate(lang, 'stats.pausedTime'), value: time(st.pausedMs) },
    { label: translate(lang, 'stats.airway'), value: airwayVal },
    { label: translate(lang, 'stats.rhythms'), value: rhythmsVal },
    { label: translate(lang, 'stats.causes'), value: causesVal },
    { label: translate(lang, 'stats.pocus'), value: pocusVal },
    { label: translate(lang, 'stats.postRosc'), value: postRoscVal },
  ];
}
