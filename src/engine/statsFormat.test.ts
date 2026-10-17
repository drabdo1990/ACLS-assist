import { describe, it, expect } from 'vitest';
import { statsRows } from './statsFormat';
import type { CodeStats } from './stats';

const base: CodeStats = {
  statsVersion: 2,
  population: 'adult',
  weightKg: null,
  weightSource: null,
  ageMonths: null,
  startedAt: 0,
  endedAt: 405_000,
  arrestMs: 405_000,
  outcome: 'rosc',
  roscCount: 1,
  firstRoscMs: 405_000,
  firstShockMs: 45_000,
  firstEpiMs: 70_000,
  branchAtFirstEpi: 'shockable',
  shocks: { count: 2, joules: [200, 360], perKg: [null, null] },
  epi: { count: 3, meanIntervalMs: 200_000, longestIntervalMs: 330_000, flagThresholdMs: 300_000, longestExceedsThreshold: true, notCalculated: 0 },
  amiodarone: { count: 1, totalMg: 300, notCalculated: 0 },
  lidocaine: { count: 0, notCalculated: 0 },
  magnesium: { count: 0, notCalculated: 0 },
  cycles: 3,
  pausedMs: 12_000,
  airway: { type: 'SGA', firstPlacedMs: 160_000 },
  rhythms: ['VF', 'pVT'],
  causes: ['hypoxia'],
  pocus: ['effusion'],
  postRosc: { done: 2, total: 8 },
};
const row = (label: string, st = base) => statsRows(st).find((r) => r.label === label)!;

describe('statsRows', () => {
  it('formats times as clocks and lists in plain text', () => {
    expect(row('Outcome').value).toBe('ROSC achieved');
    expect(row('First shock').value).toBe('00:45');
    expect(row('First epinephrine').value).toBe('01:10 (shockable branch)');
    expect(row('Shocks').value).toBe('2 (200J, 360J)');
    expect(row('Advanced airway').value).toBe('Supraglottic airway at 02:40');
    expect(row('Rhythms documented').value).toBe('VF, pVT');
    expect(row("H's & T's addressed").value).toBe('Hypoxia');
    expect(row('Post-ROSC bundle').value).toBe('2/8 recorded');
  });

  it('flags a long epinephrine interval', () => {
    expect(row('Epinephrine interval (mean / longest)')).toEqual({
      label: 'Epinephrine interval (mean / longest)',
      value: '03:20 / 05:30',
      flag: true,
    });
  });

  it('shows "—" for missing data', () => {
    const empty: CodeStats = {
      ...base,
      firstShockMs: null,
      firstEpiMs: null,
      branchAtFirstEpi: null,
      firstRoscMs: null,
      epi: { ...base.epi, count: 0, meanIntervalMs: null, longestIntervalMs: null, longestExceedsThreshold: false },
      airway: { type: null, firstPlacedMs: null },
      rhythms: [],
      causes: [],
      pocus: [],
      postRosc: null,
    };
    for (const label of ['First shock', 'First epinephrine', 'First ROSC', 'Advanced airway', 'Rhythms documented', 'Post-ROSC bundle']) {
      expect(row(label, empty).value).toBe('—');
    }
    expect(row('Epinephrine interval (mean / longest)', empty).flag).toBe(false);
  });

  it('translates rows and outcomes to Arabic with LRI-wrapped clock times', () => {
    const arRows = statsRows(base, 'ar');
    const arRow = (label: string) => arRows.find((r) => r.label === label)!;

    expect(arRow('النتيجة').value).toBe('تحققت ROSC');
    expect(arRow('أول صدمة').value).toBe('\u206600:45\u2069');
    expect(arRow('أول إبينفرين').value).toBe('\u206601:10\u2069 (مسار قابل للصدمة)');
    expect(arRow('مجرى هواء متقدم').value).toBe('مجرى هواء فوق المزمار في \u206602:40\u2069');
    expect(arRow('الأسباب المعالجة (H’s & T’s)').value).toBe('نقص الأكسجة');
    expect(arRow('نتائج POCUS').value).toBe('انصباب تاموري');
    expect(arRow('حزمة رعاية ما بعد ROSC').value).toBe('2/8 تم تسجيلها');
  });
});

