/** CSV export of the device history: UTF-8 BOM (so Excel reads Arabic), RFC 4180, formula-injection safe. */
import { isoWithOffset, type CodeRecord } from './history';

type Cell = string | number | boolean | null | undefined;

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const sec = (ms: number | null) => (ms == null ? null : Math.round(ms / 1000));
const list = (a: string[]) => a.join('; ');

const COLUMNS: Array<[string, (r: CodeRecord, offsetMin?: number) => Cell]> = [
  ['record_id', (r) => r.id],
  ['device_id', (r) => r.deviceId],
  ['unit', (r) => r.unit],
  ['start_iso', (r, o) => isoWithOffset(r.startedAt, o)],
  ['start_epoch_ms', (r) => r.startedAt],
  ['outcome', (r) => r.stats.outcome],
  ['training', (r) => r.training],
  ['voided', (r) => r.voided],
  ['arrest_s', (r) => sec(r.stats.arrestMs)],
  ['first_rosc_s', (r) => sec(r.stats.firstRoscMs)],
  ['first_shock_s', (r) => sec(r.stats.firstShockMs)],
  ['first_epi_s', (r) => sec(r.stats.firstEpiMs)],
  ['branch_at_first_epi', (r) => r.stats.branchAtFirstEpi],
  ['shock_count', (r) => r.stats.shocks.count],
  ['shock_joules', (r) => r.stats.shocks.joules.join(' ')],
  ['epi_count', (r) => r.stats.epi.count],
  ['epi_mean_interval_s', (r) => sec(r.stats.epi.meanIntervalMs)],
  ['epi_longest_interval_s', (r) => sec(r.stats.epi.longestIntervalMs)],
  ['epi_interval_over_5min', (r) => r.stats.epi.longestExceedsThreshold],
  ['amiodarone_count', (r) => r.stats.amiodarone.count],
  ['amiodarone_mg', (r) => r.stats.amiodarone.totalMg],
  ['lidocaine_count', (r) => r.stats.lidocaine.count],
  ['magnesium_count', (r) => r.stats.magnesium.count],
  ['cycles', (r) => r.stats.cycles],
  ['paused_s', (r) => sec(r.stats.pausedMs)],
  ['airway_type', (r) => r.stats.airway.type],
  ['airway_first_s', (r) => sec(r.stats.airway.firstPlacedMs)],
  ['rhythms', (r) => list(r.stats.rhythms)],
  ['causes', (r) => list(r.stats.causes)],
  ['pocus', (r) => list(r.stats.pocus)],
  ['post_rosc', (r) => (r.stats.postRosc ? `${r.stats.postRosc.done}/${r.stats.postRosc.total}` : null)],
  ['upload_status', (r) => r.uploadStatus],
];

/** `offsetMin` pins the UTC offset used for `start_iso` (tests); default is the device's. */
export function recordsToCsv(records: CodeRecord[], offsetMin?: number): string {
  const lines = [COLUMNS.map(([name]) => name).join(',')];
  for (const r of records) lines.push(COLUMNS.map(([, get]) => csvCell(get(r, offsetMin))).join(','));
  return `﻿${lines.join('\r\n')}`;
}

export function csvFilename(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `resuscode-history-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.csv`;
}
