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
import { waveformFor, waveformLabel } from '../content/calc';
import { POST_ROSC_BUNDLE } from '../content/protocols';
import { isChecklistItemOn } from './checklist';
import { MAGNESIUM_PREFIX, POST_ROSC_PREFIX, RHYTHM_CHECK_PREFIX } from './eventQueries';
import type { CodeStats } from './stats';
import { STATS_TIME_NOTE, statsRows } from './statsFormat';

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
  weightKg: number;
  /** Per-code statistics; the section is omitted when absent. */
  stats?: CodeStats | null;
  training?: boolean;
  voided?: boolean;
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: 'Not started',
  active: 'In progress — CPR ongoing',
  paused: 'In progress — CPR paused',
  rosc: 'ROSC achieved',
  terminated: 'Resuscitation terminated',
};

const BRANCH_LABEL: Record<RhythmBranch, string> = {
  shockable: 'Shockable (VF / pulseless VT)',
  nonshockable: 'Non-shockable (Asystole / PEA)',
};

/** Timeline row: `[MM:SS] HH:MM:SS  Label — detail`. */
function line(e: CodeEvent): string {
  return `[${formatClock(e.t)}] ${formatWallClock(e.at)}  ${e.label}${e.detail ? ` — ${e.detail}` : ''}`;
}

export function buildSbar(input: SbarInput, now: number = Date.now()): string {
  const total = masterElapsedMs(input, now);
  const arrest = input.startedAt != null;
  const rosc = input.events.find((e) => e.category === 'rosc');
  const addressed = CAUSES.filter((c) => input.causes[c.id]).map((c) => c.label);
  const pocus = POCUS_ITEMS.filter((p) => input.pocus[p.id]).map((p) => p.label);
  const epiMg = Math.round(input.epi.reduce((s, d) => s + (d.mg ?? 0), 0) * 100) / 100;
  const cycles = input.events.filter((e) => e.category === 'cycle').length;
  const rhythms = input.events
    .filter((e) => e.category === 'rhythm' && e.label.startsWith(RHYTHM_CHECK_PREFIX))
    .map((e) => e.label.replace(RHYTHM_CHECK_PREFIX, ''));

  const out: string[] = [];

  out.push('ResusCode — RESUSCITATION SUMMARY');
  out.push(`Generated: ${new Date(now).toLocaleString()}`);
  if (arrest) {
    out.push(`Total arrest time: ${formatClock(total)} (${formatDuration(total)})`);
    out.push(`Outcome: ${STATUS_LABEL[input.status]}`);
  } else {
    out.push('Outcome: No cardiac arrest recorded');
  }
  out.push('(PHI-free — no patient identifiers recorded)');
  out.push('');

  out.push('=== SITUATION ===');
  if (arrest) {
    out.push('Adult in-hospital cardiac arrest — Code Blue resuscitation per SHA ACLS 2024 (AHA/ERC-aligned).');
    out.push(`Code activated at ${formatWallClock(input.startedAt!)}. Arrest duration: ${formatDuration(total)}.`);
    if (rosc) out.push(`ROSC achieved at [${formatClock(rosc.t)}] (${formatWallClock(rosc.at)}).`);
  } else {
    out.push('No cardiac arrest recorded.');
  }
  out.push('');

  out.push('=== BACKGROUND ===');
  out.push(`Rhythm branch: ${input.rhythmBranch ? BRANCH_LABEL[input.rhythmBranch] : 'not selected'}`);
  out.push(`CPR cycles completed: ${cycles}`);
  out.push(
    `Advanced airway: ${
      input.airwayPlaced
        ? `${input.airwayType === 'SGA' ? 'supraglottic airway' : 'ETT'} placed (continuous compressions + 1 breath/6 s)`
        : 'not placed (30:2)'
    }`,
  );
  out.push(`Shocks delivered: ${input.shocks.length}`);
  out.push(`Epinephrine: ${input.epi.length} dose${input.epi.length === 1 ? '' : 's'} (total ${epiMg} mg)`);
  out.push(
    `Amiodarone doses: ${input.amio.length}${
      input.amio.length ? ` (${input.amio.map((d) => `${d.mg} mg`).join(', ')})` : ''
    }`,
  );
  out.push(`Lidocaine doses: ${input.lido.length}${input.lido.length ? ` (dosing weight ${input.weightKg} kg)` : ''}`);
  const mg = input.events.filter((e) => e.category === 'drug' && e.label.startsWith(MAGNESIUM_PREFIX)).length;
  if (mg) out.push(`Magnesium sulfate doses: ${mg}`);
  out.push('');

  out.push('=== ASSESSMENT ===');
  out.push(`Rhythms documented: ${rhythms.join(', ') || 'none recorded'}`);
  if (input.shocks.length) {
    const energies = input.shocks
      .map((s) => `${s.joules}J ${waveformLabel(s.waveform ?? waveformFor(s.joules))}`)
      .join(', ');
    out.push(`Defibrillation energies: ${energies}`);
  }
  out.push(`Reversible causes addressed: ${addressed.length ? addressed.join(', ') : 'none recorded'}`);
  out.push(`POCUS findings: ${pocus.length ? pocus.join(', ') : 'none recorded'}`);
  out.push('');

  if (input.stats) {
    out.push('=== CODE STATISTICS ===');
    if (input.training) out.push('TRAINING / SIMULATION — not a real patient');
    if (input.voided) out.push('VOIDED — excluded from statistics');
    out.push(`(${STATS_TIME_NOTE})`);
    for (const r of statsRows(input.stats)) out.push(`${r.label}: ${r.value}${r.flag ? ' ⚠ over 5:00' : ''}`);
    out.push('');
  }

  // Only meaningful once ROSC has occurred; otherwise every item would read as "pending".
  if (rosc) {
    const done = POST_ROSC_BUNDLE.filter((i) => isChecklistItemOn(input.events, POST_ROSC_PREFIX, i.text));
    const pending = POST_ROSC_BUNDLE.filter((i) => !done.includes(i));
    out.push('=== POST-ROSC CARE ===');
    out.push(`Completed (${done.length}/${POST_ROSC_BUNDLE.length}):`);
    for (const i of done) out.push(`  [x] ${i.text}`);
    if (!done.length) out.push('  (none recorded)');
    out.push('Not yet recorded:');
    for (const i of pending) out.push(`  [ ] ${i.text}`);
    if (!pending.length) out.push('  (none)');
    out.push('');
  }

  out.push('=== RECOMMENDATIONS ===');
  if (input.status === 'rosc') {
    out.push('- Post-ROSC bundle: secure airway (ETT), SpO₂ 92–98%, avoid hyperventilation.');
    out.push('- Hypotension: IV fluid up to 2 L, then dopamine 5–10 mcg/kg/min (or norepinephrine/epinephrine); MAP ≥ 65 mmHg.');
    out.push('- 12-lead ECG — Cath Lab for STEMI; if unresponsive, temperature control 32–37.5 °C for 12–24 h.');
    out.push('- Correct glucose > 10 mmol/L, electrolytes and acidosis; transfer to ICU/CCU; team debrief.');
  } else if (arrest) {
    out.push('- Document time of termination / handover; family communication; team debrief.');
  } else {
    out.push('- No resuscitation recorded.');
  }
  out.push('');

  out.push('=== TIMELINE ===');
  // Absolute timestamps order correctly even while the arrest clock is frozen (pause / ROSC).
  const events = [...input.events].sort((a, b) => a.at - b.at);
  if (!events.length) out.push('(no events)');
  for (const e of events) out.push(line(e));

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
