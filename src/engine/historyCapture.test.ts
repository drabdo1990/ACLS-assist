import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryKV, throwingKV } from './testing/memoryKV';
import { T0, endedSession } from './testing/fixtures';
import { emptySession, getSaveOk, reportSaveStatus } from './persistence';
import { loadHistory } from './history';
import { loadPrefs, savePrefs } from './prefs';
import { DEBOUNCE_MS, createCapture, type CaptureState } from './historyCapture';

const URL_OK = 'https://script.google.com/macros/s/AKfycbxAbC/exec';

const active = (o: Partial<CaptureState> = {}): CaptureState => ({
  ...emptySession(),
  status: 'active',
  startedAt: T0,
  events: [{ id: 'e1', at: T0, t: 0, category: 'system', label: 'Code Blue activated' }],
  rev: 3,
  ...o,
});
const ended = (o: Partial<CaptureState> = {}): CaptureState => ({ ...endedSession(), rev: 5, ...o });
const roscSession = (o: Partial<CaptureState> = {}): CaptureState =>
  ended({
    status: 'rosc',
    events: [
      { id: 'e1', at: T0, t: 0, category: 'system', label: 'Code Blue activated' },
      { id: 'e2', at: T0 + 60_000, t: 60_000, category: 'rosc', label: 'ROSC declared' },
    ],
    endedAt: T0 + 60_000,
    pausedAt: T0 + 60_000,
    shocks: [],
    ...o,
  });
const enroll = (kv: ReturnType<typeof memoryKV>) =>
  savePrefs(kv, { ...loadPrefs(kv), enrollment: { url: URL_OK, key: 'unit-icu-2026', unit: 'ICU' } });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  reportSaveStatus(true);
});

describe('history capture', () => {
  it('records once when the code reaches a terminal status', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(ended(), active({ rev: 4 }));
    const all = loadHistory(kv);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ startedAt: T0, uploadStatus: 'local', training: false });
    expect(all[0].stats.outcome).toBe('terminated');
  });

  it('ignores ticks (same rev) and non-terminal mutations', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(ended({ rev: 5 }), ended({ rev: 5 }));
    cap.handle(active({ rev: 4 }), active({ rev: 3 }));
    expect(loadHistory(kv)).toEqual([]);
  });

  it('records on reset from prev (state is already empty)', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle({ ...emptySession(), rev: 0 }, ended({ rev: 9 }));
    const all = loadHistory(kv);
    expect(all).toHaveLength(1);
    expect(all[0].startedAt).toBe(T0);
  });

  it('records an incomplete code that is reset mid-arrest', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 300_000 });
    cap.handle({ ...emptySession(), rev: 0 }, active({ rev: 7 }));
    expect(loadHistory(kv)[0].stats.outcome).toBe('incomplete');
  });

  it('does not record a trivial code (10 s, nothing logged)', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 10_000 });
    cap.handle({ ...emptySession(), rev: 0 }, active({ rev: 2 }));
    expect(loadHistory(kv)).toEqual([]);
  });

  it('rosc → terminated records immediately (status change), outcome rosc_then_terminated', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(roscSession({ rev: 6 }), active({ rev: 5 }));
    expect(loadHistory(kv)[0].stats.outcome).toBe('rosc');
    cap.handle(roscSession({ status: 'terminated', rev: 7 }), roscSession({ rev: 6 }));
    expect(loadHistory(kv)[0].stats.outcome).toBe('rosc_then_terminated');
    expect(loadHistory(kv)).toHaveLength(1);
  });

  it('debounces mutations made while already ended (training / void toggles)', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(ended(), active({ rev: 4 }));
    cap.handle(ended({ rev: 6, training: true }), ended({ rev: 5 }));
    vi.advanceTimersByTime(500);
    cap.handle(ended({ rev: 7, training: true, voided: true }), ended({ rev: 6, training: true }));
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(loadHistory(kv)[0]).toMatchObject({ training: false, voided: false });
    vi.advanceTimersByTime(1);
    expect(loadHistory(kv)[0]).toMatchObject({ training: true, voided: true });
  });

  it('flush() writes a pending debounced change immediately (pagehide)', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(ended(), active({ rev: 4 }));
    cap.handle(ended({ rev: 6, training: true }), ended({ rev: 5 }));
    cap.flush();
    expect(loadHistory(kv)[0].training).toBe(true);
  });

  it('re-arrest cancels a pending debounce', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(roscSession({ rev: 6 }), active({ rev: 5 }));
    cap.handle(roscSession({ rev: 7, training: true }), roscSession({ rev: 6 }));
    cap.handle(active({ rev: 8, training: true }), roscSession({ rev: 7, training: true }));
    vi.advanceTimersByTime(5_000);
    expect(loadHistory(kv)[0].training).toBe(false);
  });
});

describe('capture safety', () => {
  it('never throws when storage throws, and logs', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cap = createCapture({ kv: throwingKV(), now: () => T0 + 130_000 });
    expect(() => cap.handle({ ...emptySession(), rev: 0 }, ended({ rev: 9 }))).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });

  it('never throws with no storage at all', () => {
    const cap = createCapture({ kv: null, now: () => T0 + 130_000 });
    expect(() => cap.handle(ended(), active({ rev: 4 }))).not.toThrow();
  });

  it('a full store lights the NOT SAVED status instead of throwing', () => {
    const kv = memoryKV();
    kv.failWrites = true;
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    expect(() => cap.handle(ended(), active({ rev: 4 }))).not.toThrow();
    expect(getSaveOk()).toBe(false);
  });

  it('survives corrupt history JSON', () => {
    const kv = memoryKV({ 'resuscode.history.v1': '{broken' });
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    expect(() => cap.handle(ended(), active({ rev: 4 }))).not.toThrow();
    expect(loadHistory(kv)).toHaveLength(1);
  });
});

describe('enrollment-aware output', () => {
  it('not enrolled: status local, onRecorded never called', () => {
    const kv = memoryKV();
    const onRecorded = vi.fn();
    createCapture({ kv, now: () => T0 + 130_000, onRecorded }).handle(ended(), active({ rev: 4 }));
    expect(onRecorded).not.toHaveBeenCalled();
    expect(loadHistory(kv)[0].uploadStatus).toBe('local');
  });

  it('enrolled: status queued, onRecorded gets a relative-time SBAR once per real change', () => {
    const kv = memoryKV();
    enroll(kv);
    const onRecorded = vi.fn();
    const cap = createCapture({ kv, now: () => T0 + 130_000, onRecorded });
    cap.handle(ended(), active({ rev: 4 }));
    expect(onRecorded).toHaveBeenCalledTimes(1);
    const [rec, sbar] = onRecorded.mock.calls[0] as [{ uploadStatus: string; unit: string }, string];
    expect(rec).toMatchObject({ uploadStatus: 'queued', unit: 'ICU' });
    expect(sbar).toContain('RESUSCITATION SUMMARY');
    expect(sbar).not.toContain('Generated:');
    // an identical re-capture (rev bump with no data change) does not re-queue
    cap.handle(ended({ rev: 6 }), ended({ rev: 5 }));
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(onRecorded).toHaveBeenCalledTimes(1);
  });

  it('toggling training after the end re-queues the record but the uploaded SBAR text is identical (the sheet keeps its SBAR cell)', () => {
    const kv = memoryKV();
    enroll(kv);
    const onRecorded = vi.fn();
    const cap = createCapture({ kv, now: () => T0 + 130_000, onRecorded });
    cap.handle(ended(), active({ rev: 4 }));
    cap.handle(ended({ rev: 6, training: true }), ended({ rev: 5 }));
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(onRecorded).toHaveBeenCalledTimes(2);
    expect(loadHistory(kv)[0].training).toBe(true);
    expect(onRecorded.mock.calls[1][1]).toBe(onRecorded.mock.calls[0][1]);
  });

  it('onChanged fires after a history write', () => {
    const kv = memoryKV();
    const onChanged = vi.fn();
    createCapture({ kv, now: () => T0 + 130_000, onChanged }).handle(ended(), active({ rev: 4 }));
    expect(onChanged).toHaveBeenCalled();
  });
});
