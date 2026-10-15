import { describe, it, expect, vi } from 'vitest';

vi.mock('../engine/audio', () => ({
  playChime: vi.fn(),
  playClose: vi.fn(),
  playConfirm: vi.fn(),
  ensureAudio: vi.fn(),
  scheduleClick: vi.fn(),
}));
vi.mock('../engine/clock', () => ({ clockNow: () => Date.now(), resyncClock: () => {} }));

import { catchUpNext } from './useMetronome';

describe('catchUpNext', () => {
  it('leaves an on-schedule beat untouched', () => {
    expect(catchUpNext(10.05, 10)).toBe(10.05);
    expect(catchUpNext(10, 10)).toBe(10);
  });

  it('tolerates being slightly behind (within the lookahead window)', () => {
    expect(catchUpNext(9.95, 10)).toBe(9.95);
  });

  it('skips a long missed backlog instead of replaying it as a burst', () => {
    // Scheduler throttled for 120 s while the audio clock advanced: ~220 beats at 110 bpm.
    const next = catchUpNext(5, 125);
    expect(next).toBeCloseTo(125.02, 5);
    // From there the normal loop schedules at most a couple of beats, not hundreds.
    const interval = 60 / 110;
    let count = 0;
    for (let n = next; n < 125 + 0.1; n += interval) count += 1;
    expect(count).toBeLessThanOrEqual(1);
  });
});
