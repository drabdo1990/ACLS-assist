import { describe, it, expect } from 'vitest';
import { memoryKV } from './testing/memoryKV';
import { DEVICE, T0, endedSession, mkRecord, mkStats } from './testing/fixtures';
import { emptySession } from './persistence';
import {
  HISTORY_CAP,
  HISTORY_CORRUPT_KEY,
  HISTORY_KEY,
  applyRetention,
  buildRecord,
  clearHistory,
  computeAggregates,
  isoWithOffset,
  loadHistory,
  median,
  pruneHistory,
  shouldRecord,
  updateRecord,
  upsertRecord,
} from './history';

const ctx = { deviceId: DEVICE, unit: null, uploadStatus: 'local' as const };

const quiet = () =>
  mkStats({
    arrestMs: 10_000,
    roscCount: 0,
    shocks: { count: 0, joules: [] },
    epi: { ...mkStats().epi, count: 0 },
    amiodarone: { count: 0, totalMg: 0 },
    lidocaine: { count: 0 },
    magnesium: { count: 0 },
    airway: { type: null, firstPlacedMs: null },
    rhythms: [],
  });

describe('isoWithOffset', () => {
  it('formats with an explicit UTC offset', () => {
    const ms = Date.UTC(2026, 9, 16, 10, 30, 0);
    expect(isoWithOffset(ms, 180)).toBe('2026-10-16T13:30:00+03:00');
    expect(isoWithOffset(ms, -330)).toBe('2026-10-16T05:00:00-05:30');
    expect(isoWithOffset(ms, 0)).toBe('2026-10-16T10:30:00+00:00');
  });
});

describe('shouldRecord / buildRecord', () => {
  it('records a code of at least 60 s even with nothing logged', () => {
    expect(shouldRecord({ ...quiet(), arrestMs: 60_000 })).toBe(true);
    expect(shouldRecord({ ...quiet(), arrestMs: 59_999 })).toBe(false);
  });
  it('records a short code that has any clinical event', () => {
    expect(shouldRecord(quiet())).toBe(false);
    expect(shouldRecord({ ...quiet(), shocks: { count: 1, joules: [200] } })).toBe(true);
    expect(shouldRecord({ ...quiet(), roscCount: 1 })).toBe(true);
    expect(shouldRecord({ ...quiet(), rhythms: ['VF'] })).toBe(true);
    expect(shouldRecord({ ...quiet(), magnesium: { count: 1 } })).toBe(true);
    expect(shouldRecord({ ...quiet(), airway: { type: 'ETT', firstPlacedMs: 5000 } })).toBe(true);
  });
  it('"End code" alone (10 s, no events) is not recorded', () => {
    const s = endedSession({
      endedAt: T0 + 10_000,
      pausedAt: T0 + 10_000,
      shocks: [],
      events: [{ id: 'x', at: T0, t: 0, category: 'system', label: 'Code ended' }],
    });
    expect(buildRecord(s, T0 + 20_000, ctx)).toBeNull();
  });
  it('builds a record with id, flags and context', () => {
    const r = buildRecord(endedSession({ training: true }), T0 + 200_000, { ...ctx, unit: 'ICU', uploadStatus: 'queued' })!;
    expect(r.id).toBe(`${T0}-${DEVICE}`);
    expect(r).toMatchObject({ deviceId: DEVICE, startedAt: T0, unit: 'ICU', training: true, voided: false, uploadStatus: 'queued', savedAt: T0 + 200_000 });
    expect(r.stats.outcome).toBe('terminated');
  });
  it('a never-started session gives null', () => {
    expect(buildRecord(emptySession(), T0, ctx)).toBeNull();
  });
});

describe('storage', () => {
  it('upserts by id, newest data wins, order is by startedAt', () => {
    const kv = memoryKV();
    upsertRecord(kv, mkRecord(2));
    upsertRecord(kv, mkRecord(1));
    upsertRecord(kv, mkRecord(2, { training: true }));
    const all = loadHistory(kv);
    expect(all.map((r) => r.startedAt)).toEqual([mkRecord(1).startedAt, mkRecord(2).startedAt]);
    expect(all[1].training).toBe(true);
  });

  it('unchanged data is not "changed" and keeps the stored upload status', () => {
    const kv = memoryKV();
    upsertRecord(kv, mkRecord(1, { uploadStatus: 'sent' }));
    const res = upsertRecord(kv, mkRecord(1, { uploadStatus: 'queued', savedAt: 999 }));
    expect(res.changed).toBe(false);
    expect(loadHistory(kv)[0].uploadStatus).toBe('sent');
  });

  it('caps at 500 and drops the oldest', () => {
    const kv = memoryKV();
    for (let i = 0; i < HISTORY_CAP + 5; i++) upsertRecord(kv, mkRecord(i));
    const all = loadHistory(kv);
    expect(all).toHaveLength(HISTORY_CAP);
    expect(all[0].startedAt).toBe(mkRecord(5).startedAt);
  });

  it('500 worst-case records stay under 1 MB', () => {
    const big = (n: number) =>
      mkRecord(n, {}, {
        rhythms: Array.from({ length: 40 }, () => 'Asystole'),
        shocks: { count: 20, joules: Array.from({ length: 20 }, () => 360) },
        causes: ['hypovolemia', 'hypoxia', 'hydrogen_ion', 'hypo_hyperkalemia', 'hypothermia', 'hypoglycemia', 'tension_ptx', 'tamponade', 'toxins', 'thrombosis_pulmonary', 'thrombosis_coronary'],
        pocus: ['effusion', 'rv_strain', 'contractility', 'standstill', 'lung_sliding'],
      });
    const json = JSON.stringify(Array.from({ length: HISTORY_CAP }, (_, i) => big(i)));
    expect(json.length).toBeLessThan(1_000_000);
  });

  it('drops invalid entries one by one; parks unparseable JSON instead of destroying it', () => {
    const kv = memoryKV({ [HISTORY_KEY]: JSON.stringify([mkRecord(1), { id: 5 }, null, mkRecord(2)]) });
    expect(loadHistory(kv)).toHaveLength(2);
    const bad = memoryKV({ [HISTORY_KEY]: '{truncated' });
    expect(loadHistory(bad)).toEqual([]);
    expect(bad.get(HISTORY_CORRUPT_KEY)).toBe('{truncated');
  });

  it('reports a failed write', () => {
    const kv = memoryKV();
    kv.failWrites = true;
    expect(upsertRecord(kv, mkRecord(1)).saved).toBe(false);
  });

  it('updateRecord patches flags/status; unknown id is null; clearHistory empties', () => {
    const kv = memoryKV();
    upsertRecord(kv, mkRecord(1));
    expect(updateRecord(kv, mkRecord(1).id, { training: true, uploadStatus: 'queued' })!.training).toBe(true);
    expect(updateRecord(kv, 'nope', { voided: true })).toBeNull();
    clearHistory(kv);
    expect(loadHistory(kv)).toEqual([]);
  });
});

describe('retention', () => {
  const recs = [
    mkRecord(1, { uploadStatus: 'sent' }),
    mkRecord(2, { uploadStatus: 'sent_unconfirmed' }),
    mkRecord(3, { uploadStatus: 'queued' }),
    mkRecord(4, { uploadStatus: 'local' }),
  ];
  it('all keeps everything', () => expect(applyRetention(recs, { mode: 'all', keep: 100 })).toHaveLength(4));
  it('last N keeps the newest N', () =>
    expect(applyRetention(recs, { mode: 'last', keep: 2 }).map((r) => r.startedAt)).toEqual([mkRecord(3).startedAt, mkRecord(4).startedAt]));
  it('after_upload removes only confirmed (sent) records', () => {
    expect(applyRetention(recs, { mode: 'after_upload', keep: 100 }).map((r) => r.uploadStatus)).toEqual(['sent_unconfirmed', 'queued', 'local']);
  });
  it('is applied when a status turns sent', () => {
    const kv = memoryKV();
    upsertRecord(kv, mkRecord(1, { uploadStatus: 'queued' }));
    updateRecord(kv, mkRecord(1).id, { uploadStatus: 'sent' }, { mode: 'after_upload', keep: 100 });
    expect(loadHistory(kv)).toEqual([]);
  });
});

describe('aggregates', () => {
  it('median handles empty, odd, even, and ignores nulls', () => {
    expect(median([])).toEqual({ value: null, n: 0 });
    expect(median([null, null])).toEqual({ value: null, n: 0 });
    expect(median([3, 1, 2])).toEqual({ value: 2, n: 3 });
    expect(median([1, 2, 3, null, 10])).toEqual({ value: 3, n: 4 });
  });

  it('excludes training, void and incomplete; counts them separately', () => {
    const a = computeAggregates([
      mkRecord(1),
      mkRecord(2, { training: true }),
      mkRecord(3, { voided: true }),
      mkRecord(4, {}, { outcome: 'incomplete', roscCount: 0 }),
      mkRecord(5, {}, { outcome: 'terminated', roscCount: 0 }),
    ]);
    expect(a).toMatchObject({ counted: 2, excluded: 2, incomplete: 1, anyRosc: 1, showRates: false });
  });

  it('shows rates only when n >= 5, and counts "any ROSC" including rosc_then_terminated', () => {
    const rs = [
      mkRecord(1, {}, { outcome: 'rosc' }),
      mkRecord(2, {}, { outcome: 'rosc_then_terminated' }),
      mkRecord(3, {}, { outcome: 'terminated', roscCount: 0 }),
      mkRecord(4, {}, { outcome: 'terminated', roscCount: 0 }),
      mkRecord(5, {}, { outcome: 'terminated', roscCount: 0 }),
    ];
    const a = computeAggregates(rs);
    expect(a).toMatchObject({ counted: 5, anyRosc: 2, showRates: true });
    expect(a.roscRate).toBeCloseTo(0.4);
  });

  it('medians skip null metrics and report their own n', () => {
    const a = computeAggregates([
      mkRecord(1, {}, { firstEpiMs: 100_000 }),
      mkRecord(2, {}, { firstEpiMs: null }),
      mkRecord(3, {}, { firstEpiMs: 200_000 }),
    ]);
    expect(a.firstEpi).toEqual({ value: 150_000, n: 2 });
  });

  it('empty history is all zero / null, never NaN', () => {
    expect(computeAggregates([])).toMatchObject({ counted: 0, roscRate: null, showRates: false, firstEpi: { value: null, n: 0 } });
  });
});

describe('pruneHistory', () => {
  it('re-applies a tighter retention to what is already stored', () => {
    const kv = memoryKV();
    for (let i = 0; i < 5; i++) upsertRecord(kv, mkRecord(i));
    pruneHistory(kv, { mode: 'last', keep: 3 });
    expect(loadHistory(kv)).toHaveLength(3);
  });
});
