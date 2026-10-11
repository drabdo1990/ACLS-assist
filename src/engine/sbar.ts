/**
 * SBAR resuscitation summary — the plain-text debrief that gets pasted into the
 * EMR/EHR after a code. Pure and unit-tested so the output stays stable.
 *
 * Contains no patient identifiers by design (PHI-free).
 */

import type { CauseId, CodeEvent, CrisisTimers, DoseEvent, SessionStatus, ShockEvent } from './types';
import { formatClock, formatWallClock, masterElapsedMs } from './timing';
import { CAUSES } from '../content/causes';

export interface SbarInput {
  status: SessionStatus;
  startedAt: number | null;
  pausedAt: number | null;
  pausedAccumMs: number;
  events: CodeEvent[];
  shocks: ShockEvent[];
  epi: DoseEvent[];
  amio: DoseEvent[];
  crisisDoses?: DoseEvent[];
  airwayPlaced: boolean;
  causes: Partial<Record<CauseId, boolean>>;
  weightKg: number;
  crisis: CrisisTimers;
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: 'Not started',
  active: 'In progress — CPR ongoing',
  paused: 'Paused',
  rosc: 'ROSC achieved',
  terminated: 'Terminated',
};

const CRISIS_LABEL: Record<keyof CrisisTimers, string> = {
  lastDeclaredAt: 'Local anesthetic systemic toxicity (LAST) declared',
  mhDeclaredAt: 'Malignant hyperthermia suspected',
  cicoDeclaredAt: "CICO (can't intubate, can't oxygenate) declared",
  maternalStartedAt: 'Maternal cardiac arrest — perimortem clock started',
};

/** Timeline row: elapsed arrest time (when an arrest clock exists), then wall-clock time. */
function line(e: CodeEvent, withElapsed: boolean): string {
  const wall = formatWallClock(e.at);
  const stamp = withElapsed ? `${formatClock(e.t).padStart(6, ' ')}  ${wall}` : wall;
  return `${stamp}  ${e.label}${e.detail ? ` — ${e.detail}` : ''}`;
}

export function buildSbar(input: SbarInput, now: number = Date.now()): string {
  const total = masterElapsedMs(input, now);
  const addressed = CAUSES.filter((c) => input.causes[c.id]).map((c) => c.label);
  const rosc = input.events.find((e) => e.category === 'rosc');
  // Crisis-only sessions (MH, LAST, CICO without arrest) never start the arrest clock.
  const arrest = input.startedAt != null;
  const crises = (Object.keys(CRISIS_LABEL) as Array<keyof CrisisTimers>)
    .filter((k) => input.crisis[k] != null)
    .sort((a, b) => (input.crisis[a] ?? 0) - (input.crisis[b] ?? 0));

  const out: string[] = [];

  out.push('CodeOR — RESUSCITATION SUMMARY');
  out.push(`Generated: ${new Date(now).toLocaleString()}`);
  if (arrest) {
    out.push(`Total arrest time: ${formatClock(total)}`);
    out.push(`Outcome: ${STATUS_LABEL[input.status]}`);
  } else {
    out.push('Outcome: No cardiac arrest recorded');
  }
  out.push('(PHI-free — no patient identifiers recorded)');
  out.push('');

  out.push('=== SITUATION ===');
  if (arrest) {
    out.push('Cardiac arrest managed in the operating room / perioperative setting.');
    out.push(`Code started at ${formatWallClock(input.startedAt!)}. Arrest duration: ${formatClock(total)}.`);
    if (rosc) out.push(`ROSC achieved at ${formatClock(rosc.t)} (${formatWallClock(rosc.at)}).`);
  } else {
    out.push('Perioperative crisis managed in the operating room. No cardiac arrest recorded.');
  }
  for (const k of crises) out.push(`${CRISIS_LABEL[k]} at ${formatWallClock(input.crisis[k]!)}.`);
  out.push('');

  out.push('=== BACKGROUND ===');
  out.push(`Protocol weight used: ${input.weightKg} kg`);
  out.push(`CPR cycles completed: ${input.events.filter((e) => e.category === 'cycle').length}`);
  out.push(
    `Advanced airway: ${input.airwayPlaced ? 'placed (continuous compressions + 1 breath/6 s)' : 'not placed'}`,
  );
  out.push(`Shocks delivered: ${input.shocks.length}`);
  out.push(`Epinephrine doses: ${input.epi.length}`);
  out.push(`Amiodarone doses: ${input.amio.length}`);
  if (input.crisisDoses?.length) {
    out.push(`Crisis drugs: ${input.crisisDoses.map((d) => d.label).join('; ')}`);
  }
  out.push('');

  out.push('=== ASSESSMENT ===');
  out.push(
    `Rhythms documented: ${
      input.events
        .filter((e) => e.category === 'rhythm')
        .map((e) => e.label.replace('Rhythm check — ', ''))
        .join(', ') || 'none recorded'
    }`,
  );
  out.push(`Reversible causes addressed: ${addressed.length ? addressed.join(', ') : 'none recorded'}`);
  if (input.shocks.length) {
    const energies = input.shocks.map((s) => `${s.joules} J`).join(', ');
    out.push(`Defibrillation energies: ${energies}`);
  }
  out.push('');

  out.push('=== RECOMMENDATIONS ===');
  if (arrest) {
    out.push('- Continue post-cardiac arrest care bundle: target SpO₂ 92–98%, PaCO₂ 35–45 mmHg, MAP ≥ 65 mmHg.');
    out.push('- 12-lead ECG and consider PCI; targeted temperature management; treat precipitating cause.');
    out.push('- Transfer to ICU / cardiac catheter lab; debrief the team.');
  } else {
    out.push('- Continue crisis-specific management per local protocol; reassess and escalate to ICU as indicated.');
    out.push('- Debrief the team.');
  }
  out.push('');

  out.push('=== TIMELINE ===');
  // Absolute timestamps order correctly even while the arrest clock is frozen (pause / ROSC).
  const events = [...input.events].sort((a, b) => a.at - b.at);
  if (!events.length) out.push('(no events)');
  for (const e of events) out.push(line(e, arrest));

  return out.join('\n');
}

/** Filename-safe summary tag for exported files. */
export function sbarFilename(now: number = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `codeor-sbar-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}.txt`;
}
