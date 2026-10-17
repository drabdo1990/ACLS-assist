import { describe, expect, it, vi } from 'vitest';
import { makeRecordId } from './history';
import { applyFlagEditToLive, liveSessionOwnsRecord } from './flagEdit';

const T = 1_760_000_000_000;

describe('liveSessionOwnsRecord', () => {
  it('matches the record built from the live session (id = startedAt-deviceId)', () => {
    expect(liveSessionOwnsRecord(makeRecordId(T, 'dev-1'), { startedAt: T })).toBe(true);
  });

  it('does not match an older record', () => {
    expect(liveSessionOwnsRecord(makeRecordId(T - 3_600_000, 'dev-1'), { startedAt: T })).toBe(false);
  });

  it('is not fooled by a startedAt that is only a digit prefix of the other', () => {
    expect(liveSessionOwnsRecord(makeRecordId(T * 10, 'dev-1'), { startedAt: T })).toBe(false);
  });

  it('does not match when there is no live session', () => {
    expect(liveSessionOwnsRecord(makeRecordId(T, 'dev-1'), { startedAt: null })).toBe(false);
  });
});

describe('applyFlagEditToLive', () => {
  const fake = (startedAt: number | null) => {
    const setTraining = vi.fn();
    const setVoided = vi.fn();
    return { setTraining, setVoided, store: { getState: () => ({ startedAt, setTraining, setVoided }) } };
  };

  it('applies training and void to the live session that owns the record', () => {
    const f = fake(T);
    expect(applyFlagEditToLive(makeRecordId(T, 'd'), { training: true, voided: false }, f.store)).toBe(true);
    expect(f.setTraining).toHaveBeenCalledWith(true);
    expect(f.setVoided).toHaveBeenCalledWith(false);
  });

  it('only touches the flags present in the patch', () => {
    const f = fake(T);
    applyFlagEditToLive(makeRecordId(T, 'd'), { voided: true }, f.store);
    expect(f.setTraining).not.toHaveBeenCalled();
    expect(f.setVoided).toHaveBeenCalledWith(true);
  });

  it('leaves the live session alone for an older record or when idle', () => {
    const older = fake(T);
    expect(applyFlagEditToLive(makeRecordId(T - 1, 'd'), { training: true }, older.store)).toBe(false);
    const idle = fake(null);
    expect(applyFlagEditToLive(makeRecordId(T, 'd'), { training: true }, idle.store)).toBe(false);
    expect(older.setTraining).not.toHaveBeenCalled();
    expect(idle.setTraining).not.toHaveBeenCalled();
  });
});
