import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./audio', () => ({
  playChime: vi.fn(),
  playClose: vi.fn(),
  playConfirm: vi.fn(),
}));

import { useCodeStore } from './store';

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

describe('pause / resume timestamps', () => {
  it('logs "CPR Resumed" at the frozen elapsed time, not before the pause', () => {
    s().startCode();
    at(60_000);
    s().pauseCode();
    at(200_000);
    s().resumeCode();

    const paused = s().events.find((e) => e.label === 'CPR Paused')!;
    const resumed = lastEvent();
    expect(paused.t).toBe(60_000);
    expect(resumed.label).toBe('CPR Resumed');
    expect(resumed.t).toBe(60_000);
  });

  it('excludes the paused interval from later events', () => {
    s().startCode();
    at(60_000);
    s().pauseCode();
    at(200_000);
    s().resumeCode();
    at(230_000);
    s().administerEpi();
    expect(lastEvent().t).toBe(90_000);
  });
});

describe('ROSC / re-arrest', () => {
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

    s().startCode();
    const n = s().events.length;
    s().reArrest();
    expect(s().events).toHaveLength(n);
  });
});

describe('amiodarone', () => {
  it('labels first, second and additional doses', () => {
    s().startCode();
    s().administerAmiodarone();
    s().administerAmiodarone();
    s().administerAmiodarone();
    const details = s()
      .events.filter((e) => e.label.startsWith('Amiodarone'))
      .map((e) => [e.label, e.detail]);
    expect(details).toEqual([
      ['Amiodarone 300 mg IV/IO', 'First dose'],
      ['Amiodarone 150 mg IV/IO', 'Second dose'],
      ['Amiodarone 150 mg IV/IO', 'Additional dose'],
    ]);
  });
});

describe('maternal arrest & crisis resolution', () => {
  it('automatically starts the master arrest clock when maternal arrest is declared from idle', () => {
    expect(s().status).toBe('idle');
    s().declareCrisis('maternal');
    expect(s().status).toBe('active');
    expect(s().startedAt).toBe(T0);
    expect(s().crisis.maternalStartedAt).toBe(T0);
  });

  it('resolves an active crisis timer and logs the resolution', () => {
    s().declareCrisis('cico');
    expect(s().crisis.cicoDeclaredAt).toBe(T0);
    at(45_000);
    s().resolveCrisis('cico');
    expect(s().crisis.cicoDeclaredAt).toBeNull();
    expect(lastEvent().label).toContain('CICO resolved');
  });
});

describe('airway toggle & LAST low-dose epinephrine', () => {
  it('allows unmarking advanced airway if tapped by mistake', () => {
    s().startCode();
    s().markAirwayPlaced();
    expect(s().airwayPlaced).toBe(true);
    s().markAirwayPlaced();
    expect(s().airwayPlaced).toBe(false);
    expect(lastEvent().label).toContain('Airway');
  });

  it('supports logging weight-scaled low-dose epinephrine (mcg) during LAST', () => {
    s().startCode();
    s().declareCrisis('last');
    s().administerEpi(50);
    expect(s().epi).toHaveLength(1);
    expect(s().epi[0].mg).toBeCloseTo(0.05, 4);
    expect(lastEvent().label).toBe('Epinephrine 50 mcg IV/IO');
  });

  it('undoes the most recent intervention and removes its dose record', () => {
    s().startCode();
    at(10_000);
    s().administerEpi();
    expect(s().epi).toHaveLength(1);
    s().undoLastEvent();
    expect(s().epi).toHaveLength(0);
    expect(s().events.some((e) => e.label.startsWith('Epinephrine'))).toBe(false);
  });
});

