/**
 * Adult cardiac arrest algorithm (SHA ACLS 2024 Algorithm 10.3; AHA/ERC) —
 * branch-aware "what's next" prompt.
 *
 * Pure: derives step progress from what has already been logged (shocks, doses,
 * causes), so the prompt stays correct after undo, refresh, or out-of-order logging.
 * It is advisory only and never gates an intervention.
 */

import type { RhythmBranch } from '../engine/types';

export type StepFocus = 'shock' | 'epi' | 'antiarrhythmic' | 'causes' | 'cpr';

export interface AlgorithmInput {
  branch: RhythmBranch | null;
  shocks: number;
  epi: number;
  /** amiodarone + lidocaine doses */
  antiarrhythmic: number;
  causesChecked: number;
}

export interface AlgorithmStep {
  id: string;
  label: string;
  focus: StepFocus;
  state: 'done' | 'current' | 'todo';
}

export interface AlgorithmView {
  title: string;
  steps: AlgorithmStep[];
  /** Guidance once every scripted step is complete. */
  ongoing: string;
  /** Focus of the current step (null once the script is complete). */
  focus: StepFocus | null;
}

interface StepDef {
  id: string;
  label: string;
  focus: StepFocus;
  done: (i: AlgorithmInput) => boolean;
}

const SHOCKABLE: StepDef[] = [
  { id: 'shock1', label: 'Shock #1', focus: 'shock', done: (i) => i.shocks >= 1 },
  { id: 'cpr1', label: 'CPR 2 min · IV/IO access', focus: 'cpr', done: (i) => i.shocks >= 2 || i.epi >= 1 },
  { id: 'shock2', label: 'Shock #2', focus: 'shock', done: (i) => i.shocks >= 2 },
  { id: 'epi', label: 'CPR 2 min + Epinephrine 1 mg · consider advanced airway', focus: 'epi', done: (i) => i.epi >= 1 },
  { id: 'shock3', label: 'Shock #3', focus: 'shock', done: (i) => i.shocks >= 3 },
  {
    id: 'aa',
    label: 'CPR 2 min + Amiodarone 300 mg / Lidocaine · treat H’s & T’s',
    focus: 'antiarrhythmic',
    done: (i) => i.antiarrhythmic >= 1,
  },
];

const NONSHOCKABLE: StepDef[] = [
  { id: 'epi', label: 'CPR 2 min + Epinephrine 1 mg ASAP', focus: 'epi', done: (i) => i.epi >= 1 },
  { id: 'access', label: 'IV/IO access · consider advanced airway + capnography', focus: 'cpr', done: (i) => i.epi >= 1 },
  { id: 'causes', label: 'Identify reversible causes (H’s & T’s)', focus: 'causes', done: (i) => i.causesChecked >= 1 },
];

export function nextAclsStep(input: AlgorithmInput): AlgorithmView {
  if (input.branch == null) {
    return {
      title: 'Select rhythm branch',
      steps: [],
      ongoing: 'Attach monitor/defibrillator, check rhythm, then choose Shockable or Non-shockable.',
      focus: null,
    };
  }

  const defs = input.branch === 'shockable' ? SHOCKABLE : NONSHOCKABLE;
  let currentAssigned = false;
  const steps: AlgorithmStep[] = defs.map((d) => {
    if (d.done(input)) return { id: d.id, label: d.label, focus: d.focus, state: 'done' };
    if (!currentAssigned) {
      currentAssigned = true;
      return { id: d.id, label: d.label, focus: d.focus, state: 'current' };
    }
    return { id: d.id, label: d.label, focus: d.focus, state: 'todo' };
  });

  const current = steps.find((s) => s.state === 'current');

  return input.branch === 'shockable'
    ? {
        title: 'VF / pulseless VT',
        steps,
        ongoing:
          'Shock at every 2-min check while VF/pVT persists · Epi every 3–5 min · ' +
          (input.antiarrhythmic >= 2
            ? 'treat H’s & T’s.'
            : 'Amiodarone 150 mg (or Lidocaine 0.5–0.75 mg/kg q5–10 min, max 3 mg/kg) 2nd dose.'),
        focus: current?.focus ?? null,
      }
    : {
        title: 'Asystole / PEA',
        steps,
        ongoing: 'CPR 2 min → recheck rhythm · Epi every 3–5 min · if shockable, switch branch and shock.',
        focus: current?.focus ?? null,
      };
}
