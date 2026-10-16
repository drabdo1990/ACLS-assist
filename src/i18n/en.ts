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
