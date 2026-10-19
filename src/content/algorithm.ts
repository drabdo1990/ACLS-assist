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
  key: string;
  focus: StepFocus;
  state: 'done' | 'current' | 'todo';
}

export interface AlgorithmView {
  titleKey: string;
  steps: AlgorithmStep[];
  /** Guidance once every scripted step is complete. */
  ongoingKey: string;
  /** Focus of the current step (null once the script is complete). */
  focus: StepFocus | null;
}

interface StepDef {
  id: string;
  key: string;
  focus: StepFocus;
  done: (i: AlgorithmInput) => boolean;
}

const SHOCKABLE: StepDef[] = [
  { id: 'shock1', key: 'algo.step.shock1', focus: 'shock', done: (i) => i.shocks >= 1 },
  { id: 'cpr1', key: 'algo.step.cpr1', focus: 'cpr', done: (i) => i.shocks >= 2 || i.epi >= 1 },
  { id: 'shock2', key: 'algo.step.shock2', focus: 'shock', done: (i) => i.shocks >= 2 },
  { id: 'epi', key: 'algo.step.shockableEpi', focus: 'epi', done: (i) => i.epi >= 1 },
  { id: 'shock3', key: 'algo.step.shock3', focus: 'shock', done: (i) => i.shocks >= 3 },
  {
    id: 'aa',
    key: 'algo.step.aa',
    focus: 'antiarrhythmic',
    done: (i) => i.antiarrhythmic >= 1,
  },
];

const NONSHOCKABLE: StepDef[] = [
  { id: 'epi', key: 'algo.step.nonshockableEpi', focus: 'epi', done: (i) => i.epi >= 1 },
  { id: 'access', key: 'algo.step.access', focus: 'cpr', done: (i) => i.epi >= 1 },
  { id: 'causes', key: 'algo.step.causes', focus: 'causes', done: (i) => i.causesChecked >= 1 },
];

export function nextAclsStep(input: AlgorithmInput): AlgorithmView {
  if (input.branch == null) {
    return {
      titleKey: 'algo.title.none',
      steps: [],
      ongoingKey: 'algo.ongoing.none',
      focus: null,
    };
  }

  const defs = input.branch === 'shockable' ? SHOCKABLE : NONSHOCKABLE;
  let currentAssigned = false;
  const steps: AlgorithmStep[] = defs.map((d) => {
    if (d.done(input)) return { id: d.id, key: d.key, focus: d.focus, state: 'done' };
    if (!currentAssigned) {
      currentAssigned = true;
      return { id: d.id, key: d.key, focus: d.focus, state: 'current' };
    }
    return { id: d.id, key: d.key, focus: d.focus, state: 'todo' };
  });

  const current = steps.find((s) => s.state === 'current');

  if (input.branch === 'shockable') {
    const anti2 = input.antiarrhythmic >= 2;
    return {
      titleKey: 'algo.title.shockable',
      steps,
      ongoingKey: anti2 ? 'algo.ongoing.shockable2' : 'algo.ongoing.shockable1',
      focus: current?.focus ?? null,
    };
  }

  return {
    titleKey: 'algo.title.nonshockable',
    steps,
    ongoingKey: 'algo.ongoing.nonshockable',
    focus: current?.focus ?? null,
  };
}
