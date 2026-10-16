/** Labels and rows for the History panel — pure, so they are unit-tested (the panel itself has no DOM tests). */
import { isoWithOffset, type Aggregates, type CodeRecord, type Median, type UploadStatus } from './history';
import { OUTCOME_LABEL, type StatRow } from './statsFormat';
import { formatClock } from './timing';

export const UPLOAD_STATUS_LABEL: Record<UploadStatus, string> = {
  local: 'On this device only',
  queued: 'Waiting to send',
  sent: 'Sent ✓',
  sent_unconfirmed: 'Sent (not confirmed)',
  failed: 'Will retry',
  rejected: 'Rejected by the sheet',
};

const DASH = '—';

export function recordTitle(r: CodeRecord, offsetMin?: number): string {
  const when = isoWithOffset(r.startedAt, offsetMin).slice(0, 16).replace('T', ' ');
  return `${when} · ${OUTCOME_LABEL[r.stats.outcome].split(',')[0].replace(' (code not ended)', '')} · ${formatClock(r.stats.arrestMs)}`;
}

export function recordFlags(r: CodeRecord): string[] {
  return [r.training ? 'Training' : '', r.voided ? 'Void' : ''].filter(Boolean);
}

export const medianLabel = (m: Median): string => `${m.value == null ? DASH : formatClock(m.value)} (n=${m.n})`;

export function aggregateRows(a: Aggregates): StatRow[] {
  const extras = [a.incomplete ? `${a.incomplete} incomplete` : '', a.excluded ? `${a.excluded} training/void` : ''].filter(Boolean);
  const any =
    a.counted === 0
      ? DASH
      : a.showRates && a.roscRate != null
        ? `${Math.round(a.roscRate * 100)}% (${a.anyRosc}/${a.counted})`
        : `${a.anyRosc} of ${a.counted}`;
  return [
    { label: 'Codes counted', value: [String(a.counted), ...extras].join(' · ') },
    { label: 'Any ROSC', value: any },
    { label: 'Median first epinephrine', value: medianLabel(a.firstEpi) },
    { label: 'Median first shock', value: medianLabel(a.firstShock) },
    { label: 'Median arrest time', value: medianLabel(a.arrest) },
  ];
}
