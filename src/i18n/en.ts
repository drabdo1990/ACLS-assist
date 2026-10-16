/**
 * English messages — the reference language and the source of `MessageKey`.
 *
 * Clinical content (causes, POCUS, post-ROSC bundle) is NOT duplicated here: its keys are
 * generated from the content data, so the English has one source of truth.
 */
import { CAUSES } from '../content/causes';
import { POCUS_ITEMS } from '../content/pocus';
import { POST_ROSC_BUNDLE, type PostRoscId } from '../content/protocols';
import type { CauseId, PocusId } from '../engine/types';
import { EPINEPHRINE, MAGNESIUM } from '../content/calc';
import {
  AIRWAY_EVENT_PREFIX,
  BRANCH_EVENT_PREFIX,
  CODE_ENDED_LABEL,
  POST_ROSC_PREFIX,
  REARREST_LABEL,
  RHYTHM_CHECK_PREFIX,
  ROSC_LABEL,
  SGA_LABEL,
} from '../engine/eventQueries';

const UI = {
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.ar': 'العربية',
  'i18n.draftNotice': 'Arabic clinical text is a draft awaiting clinician review — English is the reference.',

  // ---- Event log (the English is the persisted audit trail: the golden test pins it) ----
  'ev.start': 'Code Blue activated',
  'ev.start.detail': 'Cardiac arrest recognised — CPR started',
  'ev.compressions': 'Chest compressions started',
  'ev.compressions.detail': 'Rate 100–120/min, depth 5–6 cm, full recoil',
  'ev.pause': 'CPR paused',
  'ev.resume': 'CPR resumed',
  'ev.cycle': 'Cycle {n} completed',
  'ev.cycle.detail': 'Rhythm check / switch compressors',
  'ev.cycle.detailRhythm': 'Rhythm: {rhythm} · switch compressors',
  'ev.rhythmCheck': `${RHYTHM_CHECK_PREFIX}{rhythm}`,
  'ev.branch': `${BRANCH_EVENT_PREFIX}{branch}`,
  'ev.rosc': ROSC_LABEL,
  'ev.rosc.detail': 'Total arrest duration: {durationMs}. Total shocks: {shocks}. Total epi: {epiMg} mg.',
  'ev.end': CODE_ENDED_LABEL,
  'ev.end.detail': 'Resuscitation ceased · total duration {durationMs}',
  'ev.rearrest': REARREST_LABEL,
  'ev.epi': 'Epinephrine 1 mg IV/IO',
  'ev.epi.detail': `Dose #{n} · ${EPINEPHRINE.flush} · ${EPINEPHRINE.intervalLabel}`,
  'ev.shock': 'Defibrillation: Shock #{n} ({joules}J {waveform})',
  'ev.shock.nonshockable': 'Logged while on non-shockable branch',
  'ev.amio': 'Amiodarone {mg} mg IV/IO',
  'ev.dose.first': 'First dose',
  'ev.dose.second': 'Second dose',
  'ev.dose.additional': 'Additional dose',
  'ev.lido': 'Lidocaine {minMg}–{maxMg} mg IV/IO',
  'ev.lido.detail': 'Dose #{n} · {perKg} ({kg} kg) · cumulative ≥ {cumMg} of max {maxMg} mg (3 mg/kg)',
  'ev.lido.detailExceeds': 'Dose #{n} · {perKg} ({kg} kg) · cumulative ≥ {cumMg} of max {maxMg} mg (3 mg/kg) · EXCEEDS 3 mg/kg',
  'ev.mag': MAGNESIUM.label,
  'ev.mag.detail': MAGNESIUM.indication,
  'ev.airway': `${AIRWAY_EVENT_PREFIX} — {airway}`,
  'ev.airway.detail': 'Continuous compressions + 1 breath every 6 s (10/min)',
  'ev.airwayOff': 'Advanced airway unmarked',
  'ev.airwayOff.detail': 'Returned to 30:2 compression-ventilation',
  'ev.causeOn': 'Cause addressed — {cause}',
  'ev.causeOff': 'Cause unchecked — {cause}',
  'ev.pocusOn': 'POCUS — {item}',
  'ev.pocusOff': 'POCUS unchecked — {item}',
  'ev.pulseCheck': 'Pulse check — no pulse',
  'ev.pulseCheck.detail': 'Continue CPR',
  'ev.postRosc.on': `${POST_ROSC_PREFIX}: {item}`,
  'ev.postRosc.off': `${POST_ROSC_PREFIX} (unchecked): {item}`,

  // ---- Event param values ----
  'rhythm.VF': 'VF',
  'rhythm.pVT': 'pVT',
  'rhythm.PEA': 'PEA',
  'rhythm.Asystole': 'Asystole',
  'rhythm.Pulse': 'Pulse',
  'branch.shockable': 'Shockable (VF / pVT)',
  'branch.nonshockable': 'Non-shockable (Asystole / PEA)',
  'waveform.biphasic': 'Biphasic',
  'waveform.monophasic': 'Monophasic',
  'airway.ETT': 'ETT',
  'airway.SGA': SGA_LABEL,

  // ---- Algorithm (prompts and steps) ----
  'algo.title.none': 'Select rhythm branch',
  'algo.ongoing.none': 'Attach monitor/defibrillator, check rhythm, then choose Shockable or Non-shockable.',
  'algo.title.shockable': 'VF / pulseless VT',
  'algo.ongoing.shockable1':
    'Shock at every 2-min check while VF/pVT persists · Epi every 3–5 min · Amiodarone 150 mg (or Lidocaine 0.5–0.75 mg/kg q5–10 min, max 3 mg/kg) 2nd dose.',
  'algo.ongoing.shockable2': 'Shock at every 2-min check while VF/pVT persists · Epi every 3–5 min · treat H’s & T’s.',
  'algo.title.nonshockable': 'Asystole / PEA',
  'algo.ongoing.nonshockable': 'CPR 2 min → recheck rhythm · Epi every 3–5 min · if shockable, switch branch and shock.',
  'algo.step.shock1': 'Shock #1',
  'algo.step.cpr1': 'CPR 2 min · IV/IO access',
  'algo.step.shock2': 'Shock #2',
  'algo.step.shockableEpi': 'CPR 2 min + Epinephrine 1 mg · consider advanced airway',
  'algo.step.shock3': 'Shock #3',
  'algo.step.aa': 'CPR 2 min + Amiodarone 300 mg / Lidocaine · treat H’s & T’s',
  'algo.step.nonshockableEpi': 'CPR 2 min + Epinephrine 1 mg ASAP',
  'algo.step.access': 'IV/IO access · consider advanced airway + capnography',
  'algo.step.causes': 'Identify reversible causes (H’s & T’s)',

  // ---- SBAR ----
  'sbar.title': 'ResusCode — RESUSCITATION SUMMARY',
  'sbar.generated': 'Generated: {date}',
  'sbar.totalArrestTime': 'Total arrest time: {clock} ({duration})',
  'sbar.outcome': 'Outcome: {outcome}',
  'sbar.outcome.none': 'No cardiac arrest recorded',
  'sbar.phiNotice': '(PHI-free — no patient identifiers recorded)',
  'sbar.section.situation': '=== SITUATION ===',
  'sbar.section.background': '=== BACKGROUND ===',
  'sbar.section.assessment': '=== ASSESSMENT ===',
  'sbar.section.stats': '=== CODE STATISTICS ===',
  'sbar.section.postRosc': '=== POST-ROSC CARE ===',
  'sbar.section.recommendations': '=== RECOMMENDATIONS ===',
  'sbar.section.timeline': '=== TIMELINE ===',
  'sbar.situation.adultArrest': 'Adult in-hospital cardiac arrest — Code Blue resuscitation per SHA ACLS 2024 (AHA/ERC-aligned).',
  'sbar.situation.activated': 'Code activated at {time}. Arrest duration: {duration}.',
  'sbar.situation.durationRel': 'Arrest duration: {duration}.',
  'sbar.situation.roscAt': 'ROSC achieved at [{clock}] ({time}).',
  'sbar.situation.roscAtRel': 'ROSC achieved at [{clock}].',
  'sbar.situation.none': 'No cardiac arrest recorded.',
  'sbar.branch': 'Rhythm branch: {branch}',
  'sbar.branch.none': 'not selected',
  'sbar.branch.shockable': 'Shockable (VF / pulseless VT)',
  'sbar.branch.nonshockable': 'Non-shockable (Asystole / PEA)',
  'sbar.cycles': 'CPR cycles completed: {n}',
  'sbar.airway.placed': 'Advanced airway: {type} placed (continuous compressions + 1 breath/6 s)',
  'sbar.airway.ett': 'ETT',
  'sbar.airway.sga': 'supraglottic airway',
  'sbar.airway.none': 'Advanced airway: not placed (30:2)',
  'sbar.shocks': 'Shocks delivered: {n}',
  'sbar.epi': 'Epinephrine: {count} {doses} (total {mg} mg)',
  'sbar.epi.dose': 'dose',
  'sbar.epi.doses': 'doses',
  'sbar.amio': 'Amiodarone doses: {count}{details}',
  'sbar.lido': 'Lidocaine doses: {count}{details}',
  'sbar.lido.weight': ' (dosing weight {kg} kg)',
  'sbar.mag': 'Magnesium sulfate doses: {count}',
  'sbar.rhythms': 'Rhythms documented: {rhythms}',
  'sbar.noneRecorded': 'none recorded',
  'sbar.shocks.energies': 'Defibrillation energies: {energies}',
  'sbar.causes': 'Reversible causes addressed: {causes}',
  'sbar.pocus': 'POCUS findings: {findings}',
  'sbar.stats.training': 'TRAINING / SIMULATION — not a real patient',
  'sbar.stats.voided': 'VOIDED — excluded from statistics',
  'sbar.stats.over5': ' ⚠ over 5:00',
  'sbar.postRosc.completed': 'Completed ({done}/{total}):',
  'sbar.postRosc.pending': 'Not yet recorded:',
  'sbar.postRosc.noneRecorded': '  (none recorded)',
  'sbar.postRosc.none': '  (none)',
  'sbar.rec.rosc1': '- Post-ROSC bundle: secure airway (ETT), SpO₂ 92–98%, avoid hyperventilation.',
  'sbar.rec.rosc2': '- Hypotension: IV fluid up to 2 L, then dopamine 5–10 mcg/kg/min (or norepinephrine/epinephrine); MAP ≥ 65 mmHg.',
  'sbar.rec.rosc3': '- 12-lead ECG — Cath Lab for STEMI; if unresponsive, temperature control 32–37.5 °C for 12–24 h.',
  'sbar.rec.rosc4': '- Correct glucose > 10 mmol/L, electrolytes and acidosis; transfer to ICU/CCU; team debrief.',
  'sbar.rec.terminated': '- Document time of termination / handover; family communication; team debrief.',
  'sbar.rec.none': '- No resuscitation recorded.',
  'sbar.timeline.empty': '(no events)',

  // ---- Status & Outcomes ----
  'status.idle': 'Not started',
  'status.active': 'In progress — CPR ongoing',
  'status.paused': 'In progress — CPR paused',
  'status.rosc': 'ROSC achieved',
  'status.terminated': 'Resuscitation terminated',
  'outcome.rosc': 'ROSC achieved',
  'outcome.rosc_then_terminated': 'ROSC achieved, later terminated',
  'outcome.terminated': 'Terminated without ROSC',
  'outcome.incomplete': 'Incomplete (code not ended)',

  // ---- Statistics Panel & Formatter ----
  'stats.outcome': 'Outcome',
  'stats.episodes': ' ({count} ROSC episodes)',
  'stats.arrestTime': 'Arrest time (ROSC periods excluded)',
  'stats.firstRosc': 'First ROSC',
  'stats.firstShock': 'First shock',
  'stats.firstEpi': 'First epinephrine',
  'stats.firstEpi.branch': ' ({branch} branch)',
  'stats.branch.shockable': 'shockable',
  'stats.branch.nonshockable': 'non-shockable',
  'stats.shocks': 'Shocks',
  'stats.epiDoses': 'Epinephrine doses',
  'stats.epiInterval': 'Epinephrine interval (mean / longest)',
  'stats.amiodarone': 'Amiodarone',
  'stats.lidoDoses': 'Lidocaine doses',
  'stats.magDoses': 'Magnesium doses',
  'stats.cycles': 'CPR cycles completed',
  'stats.pausedTime': 'Time logged as paused',
  'stats.airway': 'Advanced airway',
  'stats.airway.sga': 'Supraglottic airway at {time}',
  'stats.airway.ett': 'ETT at {time}',
  'stats.rhythms': 'Rhythms documented',
  'stats.causes': "H's & T's addressed",
  'stats.pocus': 'POCUS findings',
  'stats.postRosc': 'Post-ROSC bundle',
  'stats.postRosc.recorded': '{done}/{total} recorded',
  'stats.timeNote': 'Times are from code activation, as logged.',

  // ---- History Panel & Formatter ----
  'history.status.local': 'On this device only',
  'history.status.queued': 'Waiting to send',
  'history.status.sent': 'Sent ✓',
  'history.status.sent_unconfirmed': 'Sent (not confirmed)',
  'history.status.failed': 'Will retry',
  'history.status.rejected': 'Rejected by the sheet',
  'history.flag.training': 'Training',
  'history.flag.void': 'Void',
  'history.agg.codesCounted': 'Codes counted',
  'history.agg.incomplete': '{count} incomplete',
  'history.agg.excluded': '{count} training/void',
  'history.agg.anyRosc': 'Any ROSC',
  'history.agg.ratio': '{count} of {total}',
  'history.agg.medianFirstEpi': 'Median first epinephrine',
  'history.agg.medianFirstShock': 'Median first shock',
  'history.agg.medianArrest': 'Median arrest time',

  // ---- Upload & Rejection Labels ----
  'upload.reject.key': 'Enrollment invalid — contact admin',
  'upload.reject.update': 'Update app',
  'upload.reject.size': 'A record was too large for the sheet — contact admin',
  'upload.test.notEnrolled': 'This device is not enrolled yet.',
  'upload.test.sent': 'Delivered and confirmed ✓ — a TEST row should now be in the sheet.',
  'upload.test.sentUnconfirmed': "Sent, but this browser can't read the reply, so delivery is not confirmed. Check the sheet for a TEST row.",
  'upload.test.offline': "You're offline — try again when connected.",
  'upload.test.notJson': 'The script answered with an error page. Check the deployment is set to "Anyone" and is the latest version.',
  'upload.test.failed': 'Could not reach the script ({reason}).',
} as const;

type CauseKey = `cause.${CauseId}.${'label' | 'clue' | 'action'}`;
type PocusKey = `pocus.${PocusId}.${'view' | 'label' | 'meaning'}`;
type PostRoscKey = `postRosc.${PostRoscId}`;
type ContentKey = CauseKey | PocusKey | PostRoscKey;

export type MessageKey = keyof typeof UI | ContentKey;

function contentMessages(): Record<ContentKey, string> {
  const out: Record<string, string> = {};
  for (const c of CAUSES) {
    out[`cause.${c.id}.label`] = c.label;
    out[`cause.${c.id}.clue`] = c.clue;
    out[`cause.${c.id}.action`] = c.action;
  }
  for (const p of POCUS_ITEMS) {
    out[`pocus.${p.id}.view`] = p.view;
    out[`pocus.${p.id}.label`] = p.label;
    out[`pocus.${p.id}.meaning`] = p.meaning;
  }
  for (const i of POST_ROSC_BUNDLE) out[`postRosc.${i.id}`] = i.text;
  return out as Record<ContentKey, string>;
}

export const EN: Readonly<Record<MessageKey, string>> = { ...UI, ...contentMessages() };
