import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./audio', () => ({ playChime: vi.fn(), playClose: vi.fn(), playConfirm: vi.fn() }));
vi.mock('./clock', () => ({ clockNow: () => Date.now(), resyncClock: () => {} }));

import { useCodeStore } from './store';
import { emptySession, sanitizeSession } from './persistence';
import type { PersistedSession } from './types';

const T0 = 1_700_000_000_000;
const at = (ms: number) => vi.setSystemTime(T0 + ms);
const s = () => useCodeStore.getState();
const lastEvent = () => s().events[s().events.length - 1];

beforeEach(() => {
  vi.useFakeTimers();
  at(0);
  s().reset();
  s().setPopulation('adult'); // reset() preserves the population choice; pin adult for a clean slate
});
afterEach(() => vi.useRealTimers());

/** A minimal valid v3 adult snapshot to upgrade. */
const v3 = (): Record<string, unknown> => {
  const base = emptySession() as unknown as Record<string, unknown>;
  const raw: Record<string, unknown> = { ...base, version: 3, status: 'idle' };
  delete raw.population;
  delete raw.weightSource;
  delete raw.ageMonths;
  return raw;
};

describe('schema v4 — migration and sanitisation', () => {
  it('upgrades a v3 session to adult with empty weight metadata, all else unchanged', () => {
    const raw = { ...v3(), weightKg: 84 };
    const m = sanitizeSession(raw)!;
    expect(m).not.toBeNull();
    expect(m.version).toBe(4);
    expect(m.population).toBe('adult');
    expect(m.weightSource).toBeNull();
    expect(m.ageMonths).toBeNull();
    expect(m.weightKg).toBe(84);
  });

  it('rejects a v4 session with an invalid population (doses depend on it)', () => {
    expect(sanitizeSession({ ...emptySession(), population: 'feline' })).toBeNull();
    expect(sanitizeSession({ ...emptySession(), population: 7 })).toBeNull();
  });

  it('v4 pediatric weightKg must be null or 0.5–150; out-of-range becomes null (doses then read "Set weight")', () => {
    const peds = (weightKg: number | null) => ({ ...emptySession(), population: 'pediatric', weightKg });
    expect(sanitizeSession(peds(null))!.weightKg).toBeNull();
    expect(sanitizeSession(peds(18))!.weightKg).toBe(18);
    expect(sanitizeSession(peds(0.5))!.weightKg).toBe(0.5);
    expect(sanitizeSession(peds(150))!.weightKg).toBe(150);
    expect(sanitizeSession(peds(0.4))!.weightKg).toBeNull();
    expect(sanitizeSession(peds(200))!.weightKg).toBeNull();
    expect(sanitizeSession(peds(NaN))!.weightKg).toBeNull();
  });

  it('v4 adult weightKg keeps the full slider range 30–250 across a reload (no silent 70 kg fallback)', () => {
    const adult = (weightKg: number | null) => ({ ...emptySession(), population: 'adult', weightKg });
    expect(sanitizeSession(adult(30))!.weightKg).toBe(30);
    expect(sanitizeSession(adult(151))!.weightKg).toBe(151);
    expect(sanitizeSession(adult(200))!.weightKg).toBe(200);
    expect(sanitizeSession(adult(250))!.weightKg).toBe(250);
    expect(sanitizeSession(adult(251))!.weightKg).toBeNull();
    expect(sanitizeSession(adult(29))!.weightKg).toBeNull();
    expect(sanitizeSession(adult(null))!.weightKg).toBeNull();
    expect(sanitizeSession(adult(NaN))!.weightKg).toBeNull();
  });

  it('v4 ageMonths must be null or an integer 0–216', () => {
    expect(sanitizeSession({ ...emptySession(), ageMonths: 48 })!.ageMonths).toBe(48);
    expect(sanitizeSession({ ...emptySession(), ageMonths: null })!.ageMonths).toBeNull();
    expect(sanitizeSession({ ...emptySession(), ageMonths: 2.5 })!.ageMonths).toBeNull();
    expect(sanitizeSession({ ...emptySession(), ageMonths: 300 })!.ageMonths).toBeNull();
    expect(sanitizeSession({ ...emptySession(), ageMonths: -1 })!.ageMonths).toBeNull();
  });

  it('keeps a v2/v3 adult weight even outside the v4 pediatric range (spec: values unchanged)', () => {
    const m = sanitizeSession({ ...v3(), weightKg: 200 })!;
    expect(m.weightKg).toBe(200);
    expect(m.population).toBe('adult');
  });

  it('v4 weightSource accepts only measured | estimated | null', () => {
    expect(sanitizeSession({ ...emptySession(), weightSource: 'measured' })!.weightSource).toBe('measured');
    expect(sanitizeSession({ ...emptySession(), weightSource: 'guessed' })!.weightSource).toBeNull();
  });
});

describe('idle population toggle', () => {
  it('switching to pediatric clears the adult weight; switching back restores the default', () => {
    s().setPopulation('pediatric');
    expect(s().population).toBe('pediatric');
    expect(s().weightKg).toBeNull();
    expect(s().weightSource).toBeNull();
    expect(s().ageMonths).toBeNull();
    s().setPopulation('adult');
    expect(s().population).toBe('adult');
    expect(s().weightKg).toBe(70);
    expect(s().weightSource).toBeNull();
  });

  it('population is locked once the code starts — attempts are ignored', () => {
    s().setPopulation('pediatric');
    s().setPediatricWeight(18, 'measured');
    s().startCode();
    s().setPopulation('adult');
    expect(s().population).toBe('pediatric');
    at(60_000);
    s().declareRosc();
    s().setPopulation('adult');
    expect(s().population).toBe('pediatric');
  });
});

describe('pediatric weight entry', () => {
  it('setPediatricWeight works before the code without logging an event', () => {
    s().setPopulation('pediatric');
    s().setPediatricWeight(18, 'estimated', 48);
    expect(s().weightKg).toBe(18);
    expect(s().weightSource).toBe('estimated');
    expect(s().ageMonths).toBe(48);
    expect(s().events).toHaveLength(0);
  });

  it('each change during a code logs Weight set (first) then Weight corrected', () => {
    s().setPopulation('pediatric');
    s().startCode();
    at(60_000);
    s().setPediatricWeight(18, 'measured');
    expect(lastEvent().label).toBe('Weight set — 18 kg (measured)');
    expect(lastEvent().key).toBe('ev.weight.set.measured');
    at(120_000);
    s().setPediatricWeight(20, 'measured');
    expect(lastEvent().label).toBe('Weight corrected — 20 kg (measured)');
    expect(lastEvent().key).toBe('ev.weight.corrected.measured');
    expect(s().weightKg).toBe(20);
  });

  it('estimated weight records ageMonths and renders the age in the event', () => {
    s().setPopulation('pediatric');
    s().startCode();
    s().setPediatricWeight(16, 'estimated', 48);
    expect(lastEvent().label).toBe('Weight set — 16 kg (estimated, age 4 y)');
    expect(lastEvent().key).toBe('ev.weight.set.estimated');
    expect(s().ageMonths).toBe(48);
    s().setPediatricWeight(7, 'estimated', 6);
    expect(lastEvent().label).toBe('Weight corrected — 7 kg (estimated, age 6 m)');
    expect(lastEvent().key).toBe('ev.weight.corrected.estimatedMonths');
  });

  it('ignores invalid weights (0, negative, > 150, NaN) and non-pediatric populations', () => {
    s().setPediatricWeight(18, 'measured'); // adult idle — ignored
    expect(s().weightKg).toBe(70);
    s().setPopulation('pediatric');
    for (const bad of [0, -5, 200, NaN]) {
      s().setPediatricWeight(bad, 'measured');
    }
    expect(s().weightKg).toBeNull();
    s().startCode();
    s().setPediatricWeight(18, 'measured');
    s().terminateCode();
    s().setPediatricWeight(20, 'measured'); // terminated — ignored
    expect(s().weightKg).toBe(18);
  });
});

describe('pediatric dosing', () => {
  beforeEach(() => {
    s().setPopulation('pediatric');
  });

  it('starts without a weight and logs the population event first', () => {
    s().startCode();
    expect(s().events[0].label).toBe('Pediatric code — weight not set');
    expect(s().events[0].key).toBe('ev.pedsStart.noWeight');
    expect(s().status).toBe('active');
  });

  it('start logs the weight variant of the population event first', () => {
    s().setPediatricWeight(18, 'measured');
    s().startCode();
    expect(s().events[0].label).toBe('Pediatric code — 18 kg (measured)');
    s().reset();
    s().setPopulation('pediatric');
    s().setPediatricWeight(16, 'estimated', 48);
    s().startCode();
    expect(s().events[0].label).toBe('Pediatric code — 16 kg (estimated, age 4 y)');
  });

  it('epinephrine uses 0.01 mg/kg of the session weight', () => {
    s().setPediatricWeight(18, 'measured');
    s().startCode();
    at(60_000);
    s().administerEpi();
    expect(lastEvent().label).toBe('Epinephrine 0.18 mg IV/IO');
    expect(s().epi[0].mg).toBe(0.18);
  });

  it('epinephrine without a weight records no mg and never blocks logging', () => {
    s().startCode();
    at(60_000);
    s().administerEpi();
    expect(lastEvent().label).toBe('Epinephrine given — dose not calculated (no weight)');
    expect(s().epi[0].mg).toBeNull();
    at(120_000);
    s().administerEpi();
    expect(s().epi).toHaveLength(2);
  });

  it('a weight set mid-code changes only later doses', () => {
    s().startCode();
    at(60_000);
    s().administerEpi();
    expect(s().epi[0].mg).toBeNull();
    at(90_000);
    s().setPediatricWeight(20, 'measured');
    at(120_000);
    s().administerEpi();
    expect(s().epi[1].mg).toBe(0.2);
    expect(lastEvent().label).toBe('Epinephrine 0.2 mg IV/IO');
    expect(s().epi[0].mg).toBeNull(); // earlier dose keeps what it was logged with
  });

  it('amiodarone is 5 mg/kg (capped at 300) and logs without a weight when unset', () => {
    s().setPediatricWeight(18, 'measured');
    s().startCode();
    s().administerAmiodarone();
    expect(lastEvent().label).toBe('Amiodarone 90 mg IV/IO');
    expect(s().amio[0].mg).toBe(90);
    s().reset();
    s().setPopulation('pediatric');
    s().startCode();
    s().administerAmiodarone();
    expect(lastEvent().label).toBe('Amiodarone given — dose not calculated (no weight)');
    expect(s().amio[0].mg).toBeNull();
  });

  it('lidocaine is 1 mg/kg (capped at 100) and logs without a weight when unset', () => {
    s().setPediatricWeight(18, 'measured');
    s().startCode();
    s().administerLidocaine();
    expect(lastEvent().label).toBe('Lidocaine 18 mg IV/IO');
    expect(s().lido[0].mg).toBe(18);
    s().reset();
    s().setPopulation('pediatric');
    s().startCode();
    s().administerLidocaine();
    expect(lastEvent().label).toBe('Lidocaine given — dose not calculated (no weight)');
    expect(s().lido[0].mg).toBeNull();
  });

  it('magnesium is 25–50 mg/kg and logs without a weight when unset', () => {
    s().setPediatricWeight(18, 'measured');
    s().startCode();
    s().administerMagnesium();
    expect(lastEvent().label).toBe('Magnesium sulfate 450–900 mg IV/IO');
    s().reset();
    s().setPopulation('pediatric');
    s().startCode();
    s().administerMagnesium();
    expect(lastEvent().label).toBe('Magnesium given — dose not calculated (no weight)');
  });

  it('an unweighted pediatric shock logs with the energy set on the device and no per-kg value', () => {
    s().setPopulation('pediatric');
    s().startCode();
    s().deliverShock(20, null); // what the "Log shock — enter energy" button calls
    expect(s().shocks).toHaveLength(1);
    expect(s().shocks[0].joules).toBe(20);
    expect(s().shocks[0].perKg).toBeUndefined();
    expect(lastEvent().category).toBe('shock');
  });

  it('undo removes an unweighted dose like any other', () => {
    s().startCode();
    s().administerEpi();
    expect(s().epi).toHaveLength(1);
    s().undoLastEvent();
    expect(s().epi).toHaveLength(0);
  });
});

describe('adult behaviour is untouched by v4', () => {
  it('adult start logs no population event and epi stays the fixed 1 mg', () => {
    s().startCode();
    expect(s().events.map((e) => e.label)).toEqual(['Code Blue activated', 'Chest compressions started']);
    at(60_000);
    s().administerEpi();
    expect(lastEvent().label).toBe('Epinephrine 1 mg IV/IO');
    expect(s().epi[0].mg).toBe(1);
  });

  it('a restored adult session with a large weight keeps working (null falls back to 70 for lidocaine)', () => {
    const raw = { ...v3(), weightKg: 200, status: 'idle' } as Record<string, unknown>;
    const restored = sanitizeSession(raw) as PersistedSession;
    expect(restored.weightKg).toBe(200);
    s().setPopulation('pediatric');
    s().setPopulation('adult');
    expect(s().weightKg).toBe(70); // default restored on switching back
  });
});
