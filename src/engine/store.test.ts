import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./audio', () => ({
  playChime: vi.fn(),
  playClose: vi.fn(),
  playConfirm: vi.fn(),
}));

// Pin the hybrid clock to the (faked) wall clock so elapsed times are exact.
vi.mock('./clock', () => ({ clockNow: () => Date.now(), resyncClock: () => {} }));

import { useCodeStore } from './store';
import { masterElapsedMs } from './timing';
import { computeCodeStats } from './stats';

const T0 = 1_700_000_000_000;
const at = (ms: number) => vi.setSystemTime(T0 + ms);
const s = () => useCodeStore.getState();
const lastEvent = () => s().events[s().events.length - 1];

beforeEach(() => {
  vi.useFakeTimers();
  at(0);
  s().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('pause / resume — CPR pauses count as arrest time', () => {
  it('keeps the arrest clock running through a CPR pause', () => {
    s().startCode();
    at(60_000);
    s().pauseCode();
    at(200_000);
    s().resumeCode();
    expect(s().events.find((e) => e.label === 'CPR paused')!.t).toBe(60_000);
    expect(lastEvent().label).toBe('CPR resumed');
    expect(lastEvent().t).toBe(200_000);
    expect(s().pausedAccumMs).toBe(140_000);
  });

  it('includes the paused interval in later events', () => {
    s().startCode();
    at(60_000);
    s().pauseCode();
    at(200_000);
    s().resumeCode();
    at(230_000);
    s().administerEpi();
    expect(lastEvent().t).toBe(230_000);
  });
});

describe('ROSC / termination freeze points', () => {
  it('ROSC while CPR is paused closes the pause and freezes the clock at ROSC', () => {
    s().startCode();
    at(60_000);
    s().pauseCode();
    at(100_000);
    s().declareRosc();
    expect(s().endedAt).toBe(T0 + 100_000);
    expect(s().pausedAccumMs).toBe(40_000);
    expect(masterElapsedMs(s(), T0 + 500_000)).toBe(100_000);
  });

  it('sums two ROSC episodes and logs later events correctly', () => {
    s().startCode();
    at(100_000);
    s().declareRosc();
    at(200_000);
    s().reArrest();
    at(300_000);
    s().declareRosc();
    at(450_000);
    s().reArrest();
    expect(s().roscAccumMs).toBe(250_000);
    at(500_000);
    s().administerEpi();
    expect(lastEvent().t).toBe(250_000);
  });

  it('terminating while CPR is paused freezes at the termination time', () => {
    s().startCode();
    at(60_000);
    s().pauseCode();
    at(90_000);
    s().terminateCode();
    expect(s().endedAt).toBe(T0 + 90_000);
    expect(s().pausedAccumMs).toBe(30_000);
    expect(masterElapsedMs(s(), T0 + 999_000)).toBe(90_000);
    expect(lastEvent().t).toBe(90_000);
  });

  it('terminating from ROSC keeps the clock frozen at ROSC', () => {
    s().startCode();
    at(100_000);
    s().declareRosc();
    at(300_000);
    s().terminateCode();
    expect(s().endedAt).toBe(T0 + 100_000);
    expect(lastEvent().t).toBe(100_000);
  });
});

describe('cycle reset', () => {
  it('logs the completed cycle with the rhythm and keeps the master clock running', () => {
    s().startCode();
    at(120_000);
    s().resetCycle('VF');
    const cycle = s().events.find((e) => e.category === 'cycle')!;
    expect(cycle.label).toBe('Cycle 1 completed');
    expect(cycle.detail).toContain('Rhythm: VF');
    expect(s().cycleIndex).toBe(2);
    expect(s().cycleStartedAt).toBe(T0 + 120_000);
    expect(s().startedAt).toBe(T0);
  });
});

describe('ROSC / re-arrest', () => {
  it('summarises duration, shocks and total epi in the ROSC event', () => {
    s().startCode();
    at(45_000);
    s().deliverShock(200);
    at(70_000);
    s().administerEpi();
    at(405_000);
    s().declareRosc();
    expect(lastEvent().label).toBe('ROSC declared');
    expect(lastEvent().detail).toBe('Total arrest duration: 6m 45s. Total shocks: 1. Total epi: 1 mg.');
  });

  it('logs re-arrest at the ROSC elapsed time and resumes the clock from there', () => {
    s().startCode();
    at(300_000);
    s().declareRosc();
    at(900_000);
    s().reArrest();
    expect(lastEvent().label).toBe('Re-arrest');
    expect(lastEvent().t).toBe(300_000);
    expect(s().status).toBe('active');

    at(960_000);
    s().administerEpi();
    expect(lastEvent().t).toBe(360_000);
  });

  it('ignores re-arrest unless ROSC has been declared', () => {
    s().reArrest();
    expect(s().status).toBe('idle');
    expect(s().events).toHaveLength(0);
  });
});

describe('defibrillation', () => {
  it('tallies shocks with energy and waveform', () => {
    s().startCode();
    s().deliverShock(200);
    s().deliverShock(360);
    expect(s().shocks).toHaveLength(2);
    const labels = s().events.filter((e) => e.category === 'shock').map((e) => e.label);
    expect(labels).toEqual([
      'Defibrillation: Shock #1 (200J Biphasic)',
      'Defibrillation: Shock #2 (360J Monophasic)',
    ]);
    expect(s().shocks[1].waveform).toBe('monophasic');
  });

  it('flags shocks logged on the non-shockable branch', () => {
    s().startCode();
    s().setRhythmBranch('nonshockable');
    s().deliverShock(200);
    expect(s().shocks[0].shockable).toBe(false);
  });
});

describe('epinephrine', () => {
  it('numbers each dose', () => {
    s().startCode();
    s().administerEpi();
    at(180_000);
    s().administerEpi();
    expect(s().epi).toHaveLength(2);
    expect(lastEvent().detail).toContain('Dose #2');
    expect(lastEvent().detail).toContain('20 mL NS flush');
  });
});

describe('magnesium', () => {
  it('logs magnesium for Torsades and can be undone', () => {
    s().startCode();
    s().administerMagnesium();
    expect(lastEvent().label).toBe('Magnesium sulfate 1–2 g IV/IO');
    expect(lastEvent().detail).toBe('Torsades de pointes');
    s().undoLastEvent();
    expect(s().events.some((e) => e.label.startsWith('Magnesium'))).toBe(false);
  });
});

describe('antiarrhythmics', () => {
  it('auto-sequences amiodarone 300 → 150 mg', () => {
    s().startCode();
    s().administerAntiarrhythmic();
    s().administerAntiarrhythmic();
    s().administerAntiarrhythmic();
    const details = s()
      .events.filter((e) => e.label.startsWith('Amiodarone'))
      .map((e) => [e.label, e.detail]);
    expect(details).toEqual([
      ['Amiodarone 300 mg IV/IO', 'First dose'],
      ['Amiodarone 150 mg IV/IO', 'Second dose'],
      ['Amiodarone 150 mg IV/IO', 'Additional dose'],
    ]);
  });

  it('auto-sequences weight-based lidocaine when selected', () => {
    s().startCode();
    s().setWeight(80);
    s().setAntiarrhythmic('lidocaine');
    s().administerAntiarrhythmic();
    s().administerAntiarrhythmic();
    expect(s().lido).toHaveLength(2);
    expect(s().amio).toHaveLength(0);
    const labels = s().events.filter((e) => e.label.startsWith('Lidocaine')).map((e) => e.label);
    expect(labels).toEqual(['Lidocaine 80–120 mg IV/IO', 'Lidocaine 40–60 mg IV/IO']);
    expect(lastEvent().detail).toContain('cumulative ≥ 120 of max 240 mg (3 mg/kg)');
  });

  it('flags a lidocaine dose that exceeds the 3 mg/kg ceiling', () => {
    s().startCode();
    s().setWeight(40); // max 120 mg; doses 40, 20, 20, 20, 20 → 120, the 6th exceeds
    s().setAntiarrhythmic('lidocaine');
    for (let i = 0; i < 5; i++) s().administerAntiarrhythmic();
    expect(lastEvent().detail).not.toContain('EXCEEDS');
    s().administerAntiarrhythmic();
    expect(lastEvent().detail).toContain('EXCEEDS 3 mg/kg');
  });
});

describe('rhythm branch', () => {
  it('logs a branch change once and ignores re-selecting the same branch', () => {
    s().startCode();
    s().setRhythmBranch('shockable');
    s().setRhythmBranch('shockable');
    expect(s().rhythmBranch).toBe('shockable');
    expect(s().events.filter((e) => e.label.startsWith('Rhythm branch'))).toHaveLength(1);
  });

  it('undo restores the previous branch', () => {
    s().startCode();
    s().setRhythmBranch('shockable');
    s().setRhythmBranch('nonshockable');
    s().undoLastEvent();
    expect(s().rhythmBranch).toBe('shockable');
  });
});

describe('advanced airway', () => {
  it('records the airway type and toggles back to 30:2', () => {
    s().startCode();
    s().markAirwayPlaced('SGA');
    expect(s().airwayPlaced).toBe(true);
    expect(s().airwayType).toBe('SGA');
    expect(lastEvent().label).toBe('Advanced airway placed — Supraglottic airway');
    s().markAirwayPlaced();
    expect(s().airwayPlaced).toBe(false);
    expect(s().airwayType).toBeNull();
  });

  it('undo of a placement un-places the airway', () => {
    s().startCode();
    s().markAirwayPlaced('ETT');
    s().undoLastEvent();
    expect(s().airwayPlaced).toBe(false);
  });
});

describe('causes & POCUS', () => {
  it('stamps an addressed cause and clears it on undo', () => {
    s().startCode();
    s().toggleCause('tension_ptx');
    expect(s().causes.tension_ptx).toBe(true);
    expect(lastEvent().label).toBe('Cause addressed — Tension pneumothorax');
    s().undoLastEvent();
    expect(s().causes.tension_ptx).toBe(false);
  });

  it('includes SHA hypoglycaemia as a reversible cause', () => {
    s().startCode();
    s().toggleCause('hypoglycemia');
    expect(lastEvent().label).toBe('Cause addressed — Hypoglycaemia');
  });

  it('logs POCUS findings', () => {
    s().startCode();
    s().togglePocus('effusion');
    expect(s().pocus.effusion).toBe(true);
    expect(lastEvent().category).toBe('pocus');
  });
});

describe('undo', () => {
  it('removes the most recent dose record with its event', () => {
    s().startCode();
    at(10_000);
    s().administerEpi();
    s().undoLastEvent();
    expect(s().epi).toHaveLength(0);
    expect(s().events.some((e) => e.label.startsWith('Epinephrine'))).toBe(false);
  });

  it('never undoes lifecycle events', () => {
    s().startCode();
    const n = s().events.length;
    s().undoLastEvent();
    expect(s().events).toHaveLength(n);
  });
});

describe('undo consistency (audit fixes)', () => {
  it('undoing an airway un-mark restores the SAME airway type (SGA stays SGA)', () => {
    s().startCode();
    s().markAirwayPlaced('SGA');
    s().markAirwayPlaced(); // un-mark
    expect(s().airwayType).toBeNull();
    s().undoLastEvent();
    expect(s().airwayPlaced).toBe(true);
    expect(s().airwayType).toBe('SGA');
  });

  it('restores the most recent placement type across several place/unmark cycles', () => {
    s().startCode();
    s().markAirwayPlaced('ETT');
    s().markAirwayPlaced();
    s().markAirwayPlaced('SGA');
    s().markAirwayPlaced();
    s().undoLastEvent();
    expect(s().airwayType).toBe('SGA');
  });

  it('never undoes a cycle reset or rhythm check, so cycleIndex stays in step with the log', () => {
    s().startCode();
    at(120_000);
    s().resetCycle(); // plain reset: last event is the cycle event
    expect(s().cycleIndex).toBe(2);
    const n = s().events.length;
    s().undoLastEvent();
    expect(s().events).toHaveLength(n);
    expect(s().cycleIndex).toBe(2);
    expect(s().events.filter((e) => e.category === 'cycle')).toHaveLength(1);
  });

  it('records an un-check of a cause/POCUS item instead of leaving a stale "addressed" entry', () => {
    s().startCode();
    s().toggleCause('hypoxia');
    s().toggleCause('hypoxia');
    expect(s().causes.hypoxia).toBe(false);
    expect(lastEvent().label).toBe('Cause unchecked — Hypoxia');
    s().togglePocus('effusion');
    s().togglePocus('effusion');
    expect(s().pocus.effusion).toBe(false);
    expect(lastEvent().label.startsWith('POCUS unchecked — ')).toBe(true);
  });

  it('undoing an un-check re-checks the item; undoing a check un-checks it', () => {
    s().startCode();
    s().toggleCause('hypoxia');
    s().toggleCause('hypoxia'); // un-check
    s().undoLastEvent();
    expect(s().causes.hypoxia).toBe(true);
    s().undoLastEvent(); // undo the original check
    expect(s().causes.hypoxia).toBe(false);
  });
});

describe('rhythm check keeps the algorithm branch in step', () => {
  it('VF / pVT select the shockable branch; PEA / Asystole the non-shockable branch', () => {
    s().startCode();
    at(120_000);
    s().resetCycle('PEA');
    expect(s().rhythmBranch).toBe('nonshockable');
    at(240_000);
    s().resetCycle('VF');
    expect(s().rhythmBranch).toBe('shockable');
    expect(lastEvent().label).toBe('Rhythm branch: Shockable (VF / pVT)');
  });

  it('does not add a branch event when the branch is unchanged, and Pulse leaves it alone', () => {
    s().startCode();
    s().setRhythmBranch('shockable');
    const before = s().events.filter((e) => e.label.startsWith('Rhythm branch')).length;
    at(120_000);
    s().resetCycle('pVT');
    expect(s().events.filter((e) => e.label.startsWith('Rhythm branch'))).toHaveLength(before);
    at(240_000);
    s().resetCycle('Pulse');
    expect(s().rhythmBranch).toBe('shockable');
  });

  it('a mis-tapped rhythm can be corrected with Undo (branch rolls back)', () => {
    s().startCode();
    s().setRhythmBranch('shockable');
    at(120_000);
    s().resetCycle('PEA'); // mis-tap: meant VF
    expect(s().rhythmBranch).toBe('nonshockable');
    s().undoLastEvent();
    expect(s().rhythmBranch).toBe('shockable');
  });
});

describe('statistics follow undo', () => {
  it('drops an undone epinephrine dose from the stats', () => {
    s().startCode();
    at(60_000);
    s().administerEpi();
    expect(computeCodeStats(s(), T0 + 70_000)!.epi.count).toBe(1);
    s().undoLastEvent();
    expect(computeCodeStats(s(), T0 + 70_000)!.epi.count).toBe(0);
    expect(computeCodeStats(s(), T0 + 70_000)!.firstEpiMs).toBeNull();
  });
});

describe('training / void flags', () => {
  it('sets the flags and clears them on New code', () => {
    s().startCode();
    s().setTraining(true);
    s().setVoided(true);
    expect(s().training).toBe(true);
    expect(s().voided).toBe(true);
    s().reset();
    expect(s().training).toBe(false);
    expect(s().voided).toBe(false);
  });
});
