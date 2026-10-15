import { describe, it, expect } from 'vitest';
import { airwayFromEvents, airwayTypeFromLabel, branchFromEvents } from './eventQueries';
import type { CodeEvent } from './types';

const ev = (at: number, category: CodeEvent['category'], label: string): CodeEvent => ({ id: `${at}`, at, t: at, category, label });

describe('branchFromEvents', () => {
  it('returns the most recent branch, or null when none', () => {
    expect(branchFromEvents([])).toBeNull();
    expect(
      branchFromEvents([
        ev(1, 'rhythm', 'Rhythm branch: Shockable (VF / pVT)'),
        ev(2, 'rhythm', 'Rhythm branch: Non-shockable (Asystole / PEA)'),
      ]),
    ).toBe('nonshockable');
  });
  it('ignores rhythm checks', () => {
    expect(branchFromEvents([ev(1, 'rhythm', 'Rhythm check — VF')])).toBeNull();
  });
});

describe('airway helpers', () => {
  it('reads the airway type from a placement label', () => {
    expect(airwayTypeFromLabel('Advanced airway placed — Supraglottic airway')).toBe('SGA');
    expect(airwayTypeFromLabel('Advanced airway placed — ETT')).toBe('ETT');
  });
  it('uses the most recent placement and ignores un-marks', () => {
    expect(
      airwayFromEvents([
        ev(1, 'airway', 'Advanced airway placed — ETT'),
        ev(2, 'airway', 'Advanced airway placed — Supraglottic airway'),
        ev(3, 'airway', 'Advanced airway unmarked'),
      ]),
    ).toBe('SGA');
    expect(airwayFromEvents([])).toBe('ETT');
  });
});
