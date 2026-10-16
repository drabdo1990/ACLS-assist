/**
 * SBAR resuscitation summary — the plain-text debrief that gets pasted into the
 * EMR/EHR code documentation note. Pure and unit-tested so the output stays stable.
 *
 * Contains no patient identifiers by design (PHI-free).
 */

import type {
  AirwayType,
  CauseId,
  CodeEvent,
  DoseEvent,
  PocusId,
  RhythmBranch,
  SessionStatus,
  ShockEvent,
} from './types';
import { formatClock, formatDuration, formatWallClock, masterElapsedMs } from './timing';
import { CAUSES } from '../content/causes';
import { POCUS_ITEMS } from '../content/pocus';
import { waveformFor } from '../content/calc';
import { POST_ROSC_BUNDLE } from '../content/protocols';
import { isChecklistItemOn } from './checklist';
import { MAGNESIUM_PREFIX, POST_ROSC_PREFIX, RHYTHM_CHECK_PREFIX } from './eventQueries';
import type { CodeStats } from './stats';
import { statsRows, statsTimeNote } from './statsFormat';
import type { Lang } from '../i18n/lang';
import { formatDateTime, ltr } from '../i18n/format';
import { translate, hasKey } from '../i18n/translate';
import type { MessageKey } from '../i18n/en';
import { eventText } from '../i18n/eventText';

export interface SbarInput {
  status: SessionStatus;
  startedAt: number | null;
  endedAt: number | null;
  roscAccumMs: number;
  events: CodeEvent[];
  shocks: ShockEvent[];
  epi: DoseEvent[];
  amio: DoseEvent[];
  lido: DoseEvent[];
  rhythmBranch: RhythmBranch | null;
  airwayPlaced: boolean;
  airwayType: AirwayType | null;
  causes: Partial<Record<CauseId, boolean>>;
  pocus: Partial<Record<PocusId, boolean>>;
  weightKg: number | null;
  /** Per-code statistics; the section is omitted when absent. */
  stats?: CodeStats | null;
  training?: boolean;
  voided?: boolean;
}

export interface SbarOptions {
  /** Relative `[MM:SS]` times only: no wall-clock, no "Generated:" line, no training / void banners (upload variant). */
  relativeOnly?: boolean;
  /** Language for the generated summary (defaults to 'en'). */
  lang?: Lang;
}

/** Timeline row: `[MM:SS] HH:MM:SS  Label — detail` (or `[MM:SS]  Label — detail` when relative-only). */
function line(e: CodeEvent, relativeOnly: boolean, lang: Lang): string {
  const t = eventText(e, lang);
  const clock = formatClock(e.t);
  const timeBracket = lang === 'ar' ? ltr(`[${clock}]`) : `[${clock}]`;
  const wall = lang === 'ar' ? ltr(formatWallClock(e.at)) : formatWallClock(e.at);
  if (relativeOnly) return `${timeBracket}  ${t.label}${t.detail ? ` — ${t.detail}` : ''}`;
  return `${timeBracket} ${wall}  ${t.label}${t.detail ? ` — ${t.detail}` : ''}`;
}

export function buildSbar(input: SbarInput, now: number = Date.now(), opts: SbarOptions = {}): string {
  const rel = !!opts.relativeOnly;
  const lang: Lang = opts.lang ?? 'en';
  const isAr = lang === 'ar';
  const total = masterElapsedMs(input, now);
  const arrest = input.startedAt != null;
  const rosc = input.events.find((e) => e.category === 'rosc');
  const addressed = CAUSES.filter((c) => input.causes[c.id]).map((c) =>
    translate(lang, `cause.${c.id}.label` as MessageKey),
  );
  const pocus = POCUS_ITEMS.filter((p) => input.pocus[p.id]).map((p) =>
    translate(lang, `pocus.${p.id}.label` as MessageKey),
  );
  const epiMg = Math.round(input.epi.reduce((s, d) => s + (d.mg ?? 0), 0) * 100) / 100;
  const cycles = input.events.filter((e) => e.category === 'cycle').length;
  const rhythms = input.events
    .filter((e) => e.category === 'rhythm' && e.label.startsWith(RHYTHM_CHECK_PREFIX))
    .map((e) => e.label.replace(RHYTHM_CHECK_PREFIX, ''));

  const out: string[] = [];

  out.push(translate(lang, 'sbar.title'));
  if (!rel) out.push(translate(lang, 'sbar.generated', { date: formatDateTime(now, lang) }));
  if (arrest) {
    const clock = isAr ? ltr(formatClock(total)) : formatClock(total);
    const dur = formatDuration(total);
    out.push(translate(lang, 'sbar.totalArrestTime', { clock, duration: dur }));
    out.push(translate(lang, 'sbar.outcome', { outcome: translate(lang, `status.${input.status}` as MessageKey) }));
  } else {
    out.push(translate(lang, 'sbar.outcome', { outcome: translate(lang, 'sbar.outcome.none') }));
  }
  out.push(translate(lang, 'sbar.phiNotice'));
  out.push('');

  out.push(translate(lang, 'sbar.section.situation'));
  if (arrest) {
    out.push(translate(lang, 'sbar.situation.adultArrest'));
    const dur = isAr ? ltr(formatClock(total)) : formatDuration(total);
    if (rel) {
      out.push(translate(lang, 'sbar.situation.durationRel', { duration: dur }));
    } else {
      const actTime = isAr ? ltr(formatWallClock(input.startedAt!)) : formatWallClock(input.startedAt!);
      out.push(translate(lang, 'sbar.situation.activated', { time: actTime, duration: dur }));
    }
    if (rosc) {
      const clock = isAr ? ltr(formatClock(rosc.t)) : formatClock(rosc.t);
      if (rel) {
        out.push(translate(lang, 'sbar.situation.roscAtRel', { clock }));
      } else {
        const roscTime = isAr ? ltr(formatWallClock(rosc.at)) : formatWallClock(rosc.at);
        out.push(translate(lang, 'sbar.situation.roscAt', { clock, time: roscTime }));
      }
    }
  } else {
    out.push(translate(lang, 'sbar.situation.none'));
  }
  out.push('');

  out.push(translate(lang, 'sbar.section.background'));
  const branchText = input.rhythmBranch
    ? translate(lang, `sbar.branch.${input.rhythmBranch}` as MessageKey)
    : translate(lang, 'sbar.branch.none');
  out.push(translate(lang, 'sbar.branch', { branch: branchText }));
  out.push(translate(lang, 'sbar.cycles', { n: cycles }));
  if (input.airwayPlaced) {
    const airwayType =
      input.airwayType === 'SGA' ? translate(lang, 'sbar.airway.sga') : translate(lang, 'sbar.airway.ett');
    out.push(translate(lang, 'sbar.airway.placed', { type: airwayType }));
  } else {
    out.push(translate(lang, 'sbar.airway.none'));
  }
  out.push(translate(lang, 'sbar.shocks', { n: input.shocks.length }));
  const dosesWord = isAr
    ? translate(lang, 'sbar.epi.dose')
    : input.epi.length === 1
      ? translate(lang, 'sbar.epi.dose')
      : translate(lang, 'sbar.epi.doses');
  out.push(translate(lang, 'sbar.epi', { count: input.epi.length, doses: dosesWord, mg: epiMg }));
  const amioDetails = input.amio.length
    ? ` (${input.amio.map((d) => `${d.mg} mg`).join(isAr ? '، ' : ', ')})`
    : '';
  out.push(translate(lang, 'sbar.amio', { count: input.amio.length, details: amioDetails }));
  const lidoDetails = input.lido.length
    ? translate(lang, 'sbar.lido.weight', { kg: input.weightKg ?? 70 })
    : '';
  out.push(translate(lang, 'sbar.lido', { count: input.lido.length, details: lidoDetails }));
  const mg = input.events.filter((e) => e.category === 'drug' && e.label.startsWith(MAGNESIUM_PREFIX)).length;
  if (mg) out.push(translate(lang, 'sbar.mag', { count: mg }));
  out.push('');

  out.push(translate(lang, 'sbar.section.assessment'));
  const rhythmList = rhythms.map((r) => (hasKey(`rhythm.${r}`) ? translate(lang, `rhythm.${r}` as MessageKey) : r));
  out.push(
    translate(lang, 'sbar.rhythms', {
      rhythms: rhythmList.length ? rhythmList.join(isAr ? '، ' : ', ') : translate(lang, 'sbar.noneRecorded'),
    }),
  );
  if (input.shocks.length) {
    const energies = input.shocks
      .map(
        (s) =>
          `${s.joules}J ${translate(
            lang,
            `waveform.${s.waveform ?? waveformFor(s.joules)}` as MessageKey,
          )}`,
      )
      .join(isAr ? '، ' : ', ');
    out.push(translate(lang, 'sbar.shocks.energies', { energies }));
  }
  out.push(
    translate(lang, 'sbar.causes', {
      causes: addressed.length ? addressed.join(isAr ? '، ' : ', ') : translate(lang, 'sbar.noneRecorded'),
    }),
  );
  out.push(
    translate(lang, 'sbar.pocus', {
      findings: pocus.length ? pocus.join(isAr ? '، ' : ', ') : translate(lang, 'sbar.noneRecorded'),
    }),
  );
  out.push('');

  if (input.stats) {
    out.push(translate(lang, 'sbar.section.stats'));
    if (!rel && input.training) out.push(translate(lang, 'sbar.stats.training'));
    if (!rel && input.voided) out.push(translate(lang, 'sbar.stats.voided'));
    out.push(`(${statsTimeNote(lang)})`);
    for (const r of statsRows(input.stats, lang))
      out.push(`${r.label}: ${r.value}${r.flag ? translate(lang, 'sbar.stats.over5') : ''}`);
    out.push('');
  }

  // Only meaningful once ROSC has occurred; otherwise every item would read as "pending".
  if (rosc) {
    const done = POST_ROSC_BUNDLE.filter((i) => isChecklistItemOn(input.events, POST_ROSC_PREFIX, i.text));
    const pending = POST_ROSC_BUNDLE.filter((i) => !done.includes(i));
    out.push(translate(lang, 'sbar.section.postRosc'));
    out.push(translate(lang, 'sbar.postRosc.completed', { done: done.length, total: POST_ROSC_BUNDLE.length }));
    for (const i of done) out.push(`  [x] ${translate(lang, `postRosc.${i.id}` as MessageKey)}`);
    if (!done.length) out.push(translate(lang, 'sbar.postRosc.noneRecorded'));
    out.push(translate(lang, 'sbar.postRosc.pending'));
    for (const i of pending) out.push(`  [ ] ${translate(lang, `postRosc.${i.id}` as MessageKey)}`);
    if (!pending.length) out.push(translate(lang, 'sbar.postRosc.none'));
    out.push('');
  }

  out.push(translate(lang, 'sbar.section.recommendations'));
  if (input.status === 'rosc') {
    out.push(translate(lang, 'sbar.rec.rosc1'));
    out.push(translate(lang, 'sbar.rec.rosc2'));
    out.push(translate(lang, 'sbar.rec.rosc3'));
    out.push(translate(lang, 'sbar.rec.rosc4'));
  } else if (arrest) {
    out.push(translate(lang, 'sbar.rec.terminated'));
  } else {
    out.push(translate(lang, 'sbar.rec.none'));
  }
  out.push('');

  out.push(translate(lang, 'sbar.section.timeline'));
  // Absolute timestamps order correctly even while the arrest clock is frozen (pause / ROSC).
  const events = [...input.events].sort((a, b) => a.at - b.at);
  if (!events.length) out.push(translate(lang, 'sbar.timeline.empty'));
  for (const e of events) out.push(line(e, rel, lang));

  return out.join('\n');
}

/** Filename-safe summary tag for exported files. */
export function sbarFilename(now: number = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `resuscode-sbar-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}.txt`;
}
