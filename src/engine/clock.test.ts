import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RESYNC_MS, clockNow, resyncClock } from './clock';

const T0 = 1_700_000_000_000;
let perfNow = 0;

beforeEach(() => {
  perfNow = 5_000;
  vi.spyOn(performance, 'now').mockImplementation(() => perfNow);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  resyncClock();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('clockNow (hybrid monotonic clock)', () => {
  it('advances with performance.now from the epoch anchor', () => {
    perfNow += 750;
    vi.setSystemTime(T0 + 750);
    expect(clockNow()).toBe(T0 + 750);
  });

  it('ignores small wall-clock corrections (monotonic wins)', () => {
    perfNow += 2_000;
    vi.setSystemTime(T0 + 2_000 + RESYNC_MS - 1); // wall jumped ahead, within tolerance
    expect(clockNow()).toBe(T0 + 2_000);
  });

  it('re-anchors to the wall clock after a large drift (suspend / resume)', () => {
    // performance.now paused while the device slept for 5 minutes
    perfNow += 10;
    vi.setSystemTime(T0 + 300_000);
    expect(clockNow()).toBe(T0 + 300_000);
    // and keeps advancing monotonically from the new anchor
    perfNow += 1_000;
    vi.setSystemTime(T0 + 301_000);
    expect(clockNow()).toBe(T0 + 301_000);
  });

  it('returns whole milliseconds', () => {
    perfNow += 0.4;
    expect(Number.isInteger(clockNow())).toBe(true);
  });
});
