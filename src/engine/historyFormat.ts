import { isoWithOffset, type Aggregates, type CodeRecord, type Median, type UploadStatus } from './history';
import { outcomeLabel, OUTCOME_LABEL, type StatRow } from './statsFormat';
import { formatClock } from './timing';
import type { Lang } from '../i18n/lang';
import { translate } from '../i18n/translate';
import type { MessageKey } from '../i18n/en';
import { ltr } from '../i18n/format';

export const UPLOAD_STATUS_LABEL: Record<UploadStatus, string> = {
  local: 'On this device only',
  queued: 'Waiting to send',
  sent: 'Sent ✓',
  sent_unconfirmed: 'Sent (not confirmed)',
  failed: 'Will retry',
  rejected: 'Rejected by the sheet',
};

export function uploadStatusLabel(status: UploadStatus, lang: Lang = 'en'): string {
  return translate(lang, `history.status.${status}` as MessageKey);
}

const DASH = '—';

export function recordTitle(r: CodeRecord, offsetMin?: number, lang: Lang = 'en'): string {
  const when = isoWithOffset(r.startedAt, offsetMin).slice(0, 16).replace('T', ' ');
  const rawOutcome = lang === 'en' ? OUTCOME_LABEL[r.stats.outcome] : outcomeLabel(r.stats.outcome, lang);
  const outcome = rawOutcome
    .split('،')[0]
    .split(',')[0]
    .replace(' (code not ended)', '')
    .replace(' (لم يُنهَ النداء)', '');
  const clock = lang === 'ar' ? ltr(formatClock(r.stats.arrestMs)) : formatClock(r.stats.arrestMs);
  return `${when} · ${outcome} · ${clock}`;
}

export function recordFlags(r: CodeRecord, lang: Lang = 'en'): string[] {
  return [
    r.training ? translate(lang, 'history.flag.training') : '',
    r.voided ? translate(lang, 'history.flag.void') : '',
  ].filter(Boolean);
}

export const medianLabel = (m: Median, lang: Lang = 'en'): string => {
  const val = m.value == null ? DASH : lang === 'ar' ? ltr(formatClock(m.value)) : formatClock(m.value);
  return `${val} (n=${m.n})`;
};

export function aggregateRows(a: Aggregates, lang: Lang = 'en'): StatRow[] {
  const extras = [
    a.incomplete ? translate(lang, 'history.agg.incomplete', { count: a.incomplete }) : '',
    a.excluded ? translate(lang, 'history.agg.excluded', { count: a.excluded }) : '',
  ].filter(Boolean);
  const any =
    a.counted === 0
      ? DASH
      : a.showRates && a.roscRate != null
        ? `${Math.round(a.roscRate * 100)}% (${a.anyRosc}/${a.counted})`
        : translate(lang, 'history.agg.ratio', { count: a.anyRosc, total: a.counted });
  return [
    { label: translate(lang, 'history.agg.codesCounted'), value: [String(a.counted), ...extras].join(' · ') },
    { label: translate(lang, 'history.agg.anyRosc'), value: any },
    { label: translate(lang, 'history.agg.medianFirstEpi'), value: medianLabel(a.firstEpi, lang) },
    { label: translate(lang, 'history.agg.medianFirstShock'), value: medianLabel(a.firstShock, lang) },
    { label: translate(lang, 'history.agg.medianArrest'), value: medianLabel(a.arrest, lang) },
  ];
}
