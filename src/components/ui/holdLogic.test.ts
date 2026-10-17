import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  idleHold,
  startHold,
  cancelHold,
  releaseHold,
  tickHold,
  holdProgress,
  isHoldKey,
  HOLD_DEFAULT_MS,
} from './holdLogic';

const D = 1500;

describe('holdLogic state machine', () => {
  it('default duration stays 1.5 s', () => {
    expect(HOLD_DEFAULT_MS).toBe(1500);
  });

  it('completes only after the full duration', () => {
    let s = startHold(idleHold(), 1000);
    let r = tickHold(s, 1000 + D - 1, D);
    expect(r.complete).toBe(false);
    s = r.state;
    r = tickHold(s, 1000 + D, D);
    expect(r.complete).toBe(true);
    expect(r.progress).toBe(1);
  });

  it('a tick on an idle machine never completes', () => {
    const r = tickHold(idleHold(), 99999, D);
    expect(r.complete).toBe(false);
    expect(r.progress).toBe(0);
  });

  it('early release cancels and never completes afterwards', () => {
    let s = startHold(idleHold(), 0);
    s = cancelHold(s);
    const r = tickHold(s, 10 * D, D);
    expect(r.complete).toBe(false);
    expect(r.progress).toBe(0);
  });

  it('a second start while holding is ignored (the original start time wins)', () => {
    const first = startHold(idleHold(), 0);
    const second = startHold(first, 1000);
    expect(second).toBe(first);
    expect(tickHold(second, D, D).complete).toBe(true);
  });

  it('progress is clamped to 0..1', () => {
    const s = startHold(idleHold(), 1000);
    expect(holdProgress(s, 500, D)).toBe(0); // clock stepped backwards
    expect(holdProgress(s, 1000, D)).toBe(0);
    expect(holdProgress(s, 1000 + D / 2, D)).toBeCloseTo(0.5);
    expect(holdProgress(s, 1000 + 10 * D, D)).toBe(1);
    expect(holdProgress(idleHold(), 5000, D)).toBe(0);
  });

  it('completes exactly once per hold', () => {
    const s = startHold(idleHold(), 0);
    const done = tickHold(s, D, D);
    expect(done.complete).toBe(true);
    const again = tickHold(done.state, D + 100, D);
    expect(again.complete).toBe(false);
  });

  it('cancel after complete is a no-op', () => {
    const done = tickHold(startHold(idleHold(), 0), D, D).state;
    expect(cancelHold(done)).toBe(done);
  });

  it('release returns a completed machine to idle so a new hold can start', () => {
    const done = tickHold(startHold(idleHold(), 0), D, D).state;
    const idle = releaseHold(done);
    expect(idle).toEqual(idleHold());
    const again = startHold(idle, 5000);
    expect(tickHold(again, 5000 + D, D).complete).toBe(true);
  });

  it('a start right after completion (before release) begins a fresh full hold', () => {
    const done = tickHold(startHold(idleHold(), 0), D, D).state;
    const fresh = startHold(done, D + 50);
    expect(tickHold(fresh, D + 51, D).complete).toBe(false);
    expect(tickHold(fresh, D + 50 + D, D).complete).toBe(true);
  });
});

describe('isHoldKey', () => {
  it('accepts Space and Enter only', () => {
    expect(isHoldKey(' ')).toBe(true);
    expect(isHoldKey('Enter')).toBe(true);
    expect(isHoldKey('a')).toBe(false);
    expect(isHoldKey('Tab')).toBe(false);
    expect(isHoldKey('Escape')).toBe(false);
  });
});

/**
 * The suite is node-only (no DOM), so the component wiring is guarded at source level.
 */
describe('HoldButton wiring', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'HoldButton.tsx'), 'utf8');

  it('handles keyboard press and release', () => {
    expect(src).toMatch(/onKeyDown/);
    expect(src).toMatch(/onKeyUp/);
    expect(src).toMatch(/onBlur/);
    expect(src).toMatch(/\.repeat/);
  });

  it('has an unmount cleanup that cancels the rAF loop and the release timeout', () => {
    expect(src).toMatch(/useEffect\([\s\S]*return \(\) =>/);
    expect(src).toMatch(/cancelAnimationFrame/);
    expect(src).toMatch(/clearTimeout/);
  });

  it('describes the hold requirement to assistive tech', () => {
    expect(src).toMatch(/aria-describedby/);
  });

  it('uses the pure hold module', () => {
    expect(src).toMatch(/from '\.\/holdLogic'/);
  });
});
