/** Single source of truth for how statistics read — used by the UI panel AND the SBAR so they never disagree. */
import type { CodeStats, Outcome } from './stats';
import { formatClock } from './timing';
import { CAUSES } from '../content/causes';
import { POCUS_ITEMS } from '../content/pocus';

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

export const STATS_TIME_NOTE = 'Times are from code activation, as logged.';

const DASH = '—';
const time = (ms: number | null) => (ms == null ? DASH : formatClock(ms));
const listOr = (items: string[]) => (items.length ? items.join(', ') : DASH);

export function statsRows(st: CodeStats): StatRow[] {
  return [
    {
      label: 'Outcome',
      value: OUTCOME_LABEL[st.outcome] + (st.roscCount > 1 ? ` (${st.roscCount} ROSC episodes)` : ''),
    },
    { label: 'Arrest time (ROSC periods excluded)', value: time(st.arrestMs) },
    { label: 'First ROSC', value: time(st.firstRoscMs) },
    { label: 'First shock', value: time(st.firstShockMs) },
    {
      label: 'First epinephrine',
      value:
        st.firstEpiMs == null
          ? DASH
          : `${time(st.firstEpiMs)}${
              st.branchAtFirstEpi ? ` (${st.branchAtFirstEpi === 'shockable' ? 'shockable' : 'non-shockable'} branch)` : ''
            }`,
    },
    {
      label: 'Shocks',
      value: st.shocks.count ? `${st.shocks.count} (${st.shocks.joules.map((j) => `${j}J`).join(', ')})` : '0',
    },
    { label: 'Epinephrine doses', value: String(st.epi.count) },
    {
      label: 'Epinephrine interval (mean / longest)',
      value: st.epi.meanIntervalMs == null ? DASH : `${time(st.epi.meanIntervalMs)} / ${time(st.epi.longestIntervalMs)}`,
      flag: st.epi.longestExceedsThreshold,
    },
    {
      label: 'Amiodarone',
      value: st.amiodarone.count ? `${st.amiodarone.count} (${st.amiodarone.totalMg} mg)` : '0',
    },
    { label: 'Lidocaine doses', value: String(st.lidocaine.count) },
    { label: 'Magnesium doses', value: String(st.magnesium.count) },
    { label: 'CPR cycles completed', value: String(st.cycles) },
    { label: 'Time logged as paused', value: time(st.pausedMs) },
    {
      label: 'Advanced airway',
      value:
        st.airway.type == null
          ? DASH
          : `${st.airway.type === 'SGA' ? 'Supraglottic airway' : 'ETT'} at ${time(st.airway.firstPlacedMs)}`,
    },
    { label: 'Rhythms documented', value: listOr(st.rhythms) },
    { label: "H's & T's addressed", value: listOr(CAUSES.filter((c) => st.causes.includes(c.id)).map((c) => c.label)) },
    { label: 'POCUS findings', value: listOr(POCUS_ITEMS.filter((p) => st.pocus.includes(p.id)).map((p) => p.label)) },
    { label: 'Post-ROSC bundle', value: st.postRosc ? `${st.postRosc.done}/${st.postRosc.total} recorded` : DASH },
  ];
}
