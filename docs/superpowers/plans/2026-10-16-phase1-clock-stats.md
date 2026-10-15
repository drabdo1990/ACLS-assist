# Phase 1 — Arrest Clock v3, Code Statistics, Per-code Summary: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the arrest clock count CPR-paused time (only ROSC periods excluded), then compute and show per-code statistics on the Log screen and in the SBAR. Each code gets Training and Void flags.

**Architecture:**
- **Clock:** the session schema goes to v3. `endedAt` freezes the master clock and `roscAccumMs` holds closed ROSC intervals. `pausedAt` stays only for the 2-minute cycle timer, and `pausedAccumMs` narrows to CPR-pause time. Older (v1/v2) snapshots are upgraded by deriving these values from the event log.
- **Statistics:** a pure `computeCodeStats` derives everything from the existing session data. A pure `statsRows` formatter feeds both the UI panel and the SBAR, so the two always show the same values.
- **Shared labels:** canonical event labels move into one module that the store, SBAR, persistence and stats all import.

**Tech Stack:** React 19, TypeScript 7, Zustand 5, Vite 8, Vitest 5 (`environment: 'node'`, tests in `src/**/*.test.ts`), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-16-stats-admin-i18n-design.md` (sections 4.1–4.3)

## Global Constraints
- No new dependencies; do not modify `package.json`.
- Tests live in `src/**/*.test.ts` and run in Node; no DOM tests.
- **Arrest-time rule:** `arrestMs = (endedAt ?? now) − startedAt − roscAccumMs`. CPR pauses count.
- "From activation" times = `event.at − startedAt` (wall-clock), labelled **"from activation, as logged"**.
- Missing or legacy data → `null` / "—". Never throw, never show a fake 0.
- Existing logged event `t` values are never rewritten.
- Canonical English event labels are part of the persisted audit trail and must not change.
- Every task ends with `npm run typecheck` and `npm test` green, then a commit.

## Spec corrections made by this plan (Task 4 edits the spec to match)
1. **Outcome id `rosc_rearrest` → `rosc_then_terminated`** ("ROSC achieved, later terminated"). The store also allows terminating directly from ROSC, so "re-arrest" was not always true.
2. **The epinephrine-interval flag uses the guideline upper bound of 5:00** (`EPI_INTERVAL_FLAG_MS = 300_000`), not the configured lockout. The lockout is the *minimum* re-dose interval (3/4/5 min), so with a 3-min setting the old rule would flag normal 3:30 intervals. Fields: `flagThresholdMs`, `longestExceedsThreshold`.
3. **The session flag is named `voided`, not `void`** (`void` is a JS keyword and breaks destructuring). The sheet column in phase 2 stays named `void`.

## Review Focus
1. **ROSC declared while CPR is paused.** The pause up to ROSC is added to `pausedAccumMs`, and the clock freezes at the ROSC time (Task 3 test).
2. **Two ROSC → re-arrest episodes.** `roscAccumMs` sums both, and event `t` after the second re-arrest is correct (Task 3 test).
3. **A v2 snapshot saved during an open CPR pause, then restored.** The arrest time includes the pause, and `pausedAccumMs` never goes negative (Task 2 test).
4. **Terminating directly from ROSC.** The clock stays frozen at ROSC, and the outcome is `rosc_then_terminated` (Task 3 and Task 4 tests).
5. **Undoing the last epinephrine.** It disappears from the stats. A never-started session gives `null` stats and no panel (Task 4 and Task 6 tests).

---

### Task 1: Shared canonical event labels (`eventQueries.ts`)

**Files:**
- Create: `src/engine/eventQueries.ts`
- Create: `src/engine/eventQueries.test.ts`
- Modify: `src/engine/store.ts` (remove local `BRANCH_EVENT_PREFIX`, `AIRWAY_EVENT_PREFIX`, `RHYTHM_CHECK_PREFIX`, `branchFromEvents`, `airwayFromEvents`; import them instead; use label constants for ROSC / Re-arrest / Code ended)
- Modify: `src/engine/sbar.ts` (use `RHYTHM_CHECK_PREFIX`, `MAGNESIUM_PREFIX`, `POST_ROSC_PREFIX`)
- Modify: `src/components/causes/PostRoscBundle.tsx` (`prefix={POST_ROSC_PREFIX}`)

**Interfaces:**
- Produces: `BRANCH_EVENT_PREFIX`, `RHYTHM_CHECK_PREFIX`, `AIRWAY_EVENT_PREFIX`, `SGA_LABEL`, `MAGNESIUM_PREFIX`, `POST_ROSC_PREFIX`, `ROSC_LABEL`, `REARREST_LABEL`, `CODE_ENDED_LABEL` (all `string`); `branchFromEvents(events: CodeEvent[]): RhythmBranch | null`; `airwayTypeFromLabel(label: string): AirwayType`; `airwayFromEvents(events: CodeEvent[]): AirwayType`.

- [ ] **Step 1: Write the failing test** — `src/engine/eventQueries.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/eventQueries.test.ts`
Expected: FAIL — cannot resolve `./eventQueries`.

- [ ] **Step 3: Implement** — `src/engine/eventQueries.ts`

```ts
import type { AirwayType, CodeEvent, RhythmBranch } from './types';

/**
 * Canonical (English) event labels that logic depends on. Labels are part of the persisted
 * audit trail, so these strings must never change once shipped.
 */
export const BRANCH_EVENT_PREFIX = 'Rhythm branch: ';
export const RHYTHM_CHECK_PREFIX = 'Rhythm check — ';
export const AIRWAY_EVENT_PREFIX = 'Advanced airway placed';
export const SGA_LABEL = 'Supraglottic airway';
export const MAGNESIUM_PREFIX = 'Magnesium';
export const POST_ROSC_PREFIX = 'Post-ROSC';
export const ROSC_LABEL = 'ROSC declared';
export const REARREST_LABEL = 'Re-arrest';
export const CODE_ENDED_LABEL = 'Code ended';

/** Branch implied by the most recent branch event. */
export function branchFromEvents(events: CodeEvent[]): RhythmBranch | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.category === 'rhythm' && e.label.startsWith(BRANCH_EVENT_PREFIX)) {
      return e.label.includes('Non-shockable') ? 'nonshockable' : 'shockable';
    }
  }
  return null;
}

export function airwayTypeFromLabel(label: string): AirwayType {
  return label.includes(SGA_LABEL) ? 'SGA' : 'ETT';
}

/** Airway type implied by the most recent placement event. */
export function airwayFromEvents(events: CodeEvent[]): AirwayType {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.category === 'airway' && e.label.startsWith(AIRWAY_EVENT_PREFIX)) return airwayTypeFromLabel(e.label);
  }
  return 'ETT';
}
```

Then in `src/engine/store.ts`:
- Delete the local definitions of `BRANCH_EVENT_PREFIX`, `AIRWAY_EVENT_PREFIX`, `RHYTHM_CHECK_PREFIX`, `branchFromEvents` and `airwayFromEvents`.
- Add the import:

```ts
import {
  AIRWAY_EVENT_PREFIX, BRANCH_EVENT_PREFIX, CODE_ENDED_LABEL, REARREST_LABEL, RHYTHM_CHECK_PREFIX,
  ROSC_LABEL, SGA_LABEL, airwayFromEvents, branchFromEvents,
} from './eventQueries';
```

- Change `AIRWAY_LABEL` to `{ ETT: 'ETT', SGA: SGA_LABEL }`.
- Replace the literals `'ROSC declared'` (in `declareRosc`), `'Re-arrest'` (in `reArrest`) and `'Code ended'` (in `terminateCode`) with `ROSC_LABEL`, `REARREST_LABEL` and `CODE_ENDED_LABEL`.

In `src/engine/sbar.ts`:
- `import { MAGNESIUM_PREFIX, POST_ROSC_PREFIX, RHYTHM_CHECK_PREFIX } from './eventQueries';`
- Replace both `'Rhythm check — '` literals with `RHYTHM_CHECK_PREFIX`, `startsWith('Magnesium')` with `startsWith(MAGNESIUM_PREFIX)`, and `'Post-ROSC'` in the `isChecklistItemOn(...)` call with `POST_ROSC_PREFIX`.

In `src/components/causes/PostRoscBundle.tsx`:
- `import { POST_ROSC_PREFIX } from '../../engine/eventQueries';`
- Use `prefix={POST_ROSC_PREFIX}`.

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm run typecheck && npm test`
Expected: all pass (96 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/engine/eventQueries.ts src/engine/eventQueries.test.ts src/engine/store.ts src/engine/sbar.ts src/components/causes/PostRoscBundle.tsx
git commit -m "refactor: centralise canonical event labels and label queries"
```

---

### Task 2: Session schema v3 and migration

**Files:**
- Modify: `src/engine/types.ts` (`PersistedSession`)
- Modify: `src/engine/persistence.ts` (`emptySession`, `migrateV1`, `sanitizeSession`, new `deriveClockFromEvents`)
- Modify: `src/engine/store.ts` (`toPersisted` only)
- Test: `src/engine/persistence.test.ts`

**Interfaces:**
- Consumes: `REARREST_LABEL`, `CODE_ENDED_LABEL` (Task 1).
- Produces: `PersistedSession.version: 3` with the new fields `endedAt: number | null`, `roscAccumMs: number`, `training: boolean`, `voided: boolean`; `deriveClockFromEvents(events: CodeEvent[], status: SessionStatus, pausedAt: number | null): { roscAccumMs: number; endedAt: number | null }`.

- [ ] **Step 1: Write the failing tests** — in `src/engine/persistence.test.ts`:
  - Add `deriveClockFromEvents` to the import list.
  - In `describe('migrateV1')` change `expect(m.version).toBe(2)` to `.toBe(3)`.
  - In `describe('sanitizeSession')` change `{ ...good(), version: 3 }` to `{ ...good(), version: 4 }`.
  - Append:

```ts
describe('v2 → v3 migration', () => {
  const ev = (at: number, category: string, label: string) => ({ id: `${at}`, at: T0 + at, t: at, category, label });

  it('derives ROSC intervals and endedAt from the log', () => {
    const events = [
      ev(0, 'system', 'Code Blue activated'),
      ev(100_000, 'rosc', 'ROSC declared'),
      ev(160_000, 'system', 'Re-arrest'),
      ev(300_000, 'rosc', 'ROSC declared'),
    ];
    expect(deriveClockFromEvents(events as never, 'rosc', T0 + 300_000)).toEqual({
      roscAccumMs: 60_000,
      endedAt: T0 + 300_000,
    });
  });

  it('uses the Code ended time for terminated sessions (not the pause start)', () => {
    const events = [ev(0, 'system', 'Code Blue activated'), ev(50_000, 'system', 'CPR paused'), ev(90_000, 'system', 'Code ended')];
    expect(deriveClockFromEvents(events as never, 'terminated', T0 + 50_000).endedAt).toBe(T0 + 90_000);
  });

  it('upgrades a v2 snapshot, narrowing pausedAccumMs to CPR-pause time only', () => {
    const v2: Record<string, unknown> = {
      ...good(),
      version: 2,
      status: 'active',
      pausedAccumMs: 80_000, // 60 s ROSC + 20 s CPR pause, mixed in v2
      events: [
        ev(0, 'system', 'Code Blue activated'),
        ev(100_000, 'rosc', 'ROSC declared'),
        ev(160_000, 'system', 'Re-arrest'),
      ],
    };
    delete v2.endedAt;
    delete v2.roscAccumMs;
    const s = sanitizeSession(v2)!;
    expect(s.version).toBe(3);
    expect(s.roscAccumMs).toBe(60_000);
    expect(s.pausedAccumMs).toBe(20_000);
    expect(s.endedAt).toBeNull();
    expect(s.training).toBe(false);
    expect(s.voided).toBe(false);
  });

  it('keeps an open CPR pause from a v2 snapshot without going negative', () => {
    const v2 = { ...good(), version: 2, status: 'paused', pausedAt: T0 + 40_000, pausedAccumMs: 0 };
    const s = sanitizeSession(v2)!;
    expect(s.status).toBe('paused');
    expect(s.pausedAccumMs).toBe(0);
    expect(s.endedAt).toBeNull();
  });

  it('rejects a v3 ROSC/terminated session without endedAt', () => {
    expect(sanitizeSession({ ...good(), status: 'rosc', pausedAt: T0 + 1, endedAt: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/persistence.test.ts`
Expected: FAIL (`deriveClockFromEvents` not exported; version mismatches).

- [ ] **Step 3: Implement**

In `src/engine/types.ts`, inside `PersistedSession`, change `version: 2;` to `version: 3;`. Update the comment on `pausedAccumMs` to `/** Total CPR-pause time (v3). Drives the 2-min cycle and "time logged as paused"; NOT subtracted from arrest time. */`. Then add, after `pausedAccumMs`:

```ts
  /** Master clock freeze point: set at ROSC and termination, cleared on re-arrest. */
  endedAt: number | null;
  /** Sum of closed ROSC intervals — the only time excluded from arrest time. */
  roscAccumMs: number;
  /** Training / simulation code (excluded from statistics aggregates). */
  training: boolean;
  /** Voided: kept, but excluded from statistics. */
  voided: boolean;
```

In `src/engine/persistence.ts`:
- `emptySession()`: `version: 3`, and add `endedAt: null, roscAccumMs: 0, training: false, voided: false,`.
- Import the types `CodeEvent` and `SessionStatus`, and `import { CODE_ENDED_LABEL, REARREST_LABEL } from './eventQueries';`.
- Add:

```ts
/** Clock fields derived from the event log — upgrades v1/v2 snapshots (whose pausedAccumMs mixed ROSC time in). */
export function deriveClockFromEvents(
  events: CodeEvent[],
  status: SessionStatus,
  pausedAt: number | null,
): { roscAccumMs: number; endedAt: number | null } {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  let open: number | null = null;
  let lastRosc: number | null = null;
  let codeEnded: number | null = null;
  let roscAccumMs = 0;
  for (const e of sorted) {
    if (e.category === 'rosc') {
      open = e.at;
      lastRosc = e.at;
    } else if (e.category === 'system' && e.label === REARREST_LABEL && open != null) {
      roscAccumMs += Math.max(0, e.at - open);
      open = null;
    } else if (e.category === 'system' && e.label === CODE_ENDED_LABEL) {
      codeEnded = e.at;
    }
  }
  const endedAt =
    status === 'rosc' ? (lastRosc ?? pausedAt) : status === 'terminated' ? (codeEnded ?? pausedAt) : null;
  return { roscAccumMs, endedAt };
}
```

- `migrateV1`: assign the object it currently returns to `const session: PersistedSession = { ... }` (unchanged contents), then:

```ts
  const clock = deriveClockFromEvents(session.events, session.status, session.pausedAt);
  return { ...session, ...clock, pausedAccumMs: Math.max(0, session.pausedAccumMs - clock.roscAccumMs) };
```

- `sanitizeSession`:
  - Change the first line to `if (!isObj(raw) || (raw.version !== 2 && raw.version !== 3)) return null;`
  - Add the field reads below the `cyclePausedAccumMs` line:

```ts
  const isBool = (x: unknown) => typeof x === 'boolean';
  const endedAtRaw = field<number | null>(raw.endedAt, nullableNum, null);
  const roscAccumRaw = field(raw.roscAccumMs, nonNegative, 0);
  const training = field(raw.training, isBool, false);
  const voided = field(raw.voided, isBool, false);
```

  - Add `|| endedAtRaw === undefined || roscAccumRaw === undefined || training === undefined || voided === undefined` to the big `undefined` check.
  - Directly after the two existing cross-field invariant checks, add:

```ts
  // v2 → v3: pausedAccumMs mixed ROSC time in; rebuild the clock from the log.
  let endedAt = endedAtRaw;
  let roscAccumMs = roscAccumRaw;
  let cprPausedMs = pausedAccumMs;
  if (raw.version === 2) {
    const clock = deriveClockFromEvents(events, status, pausedAt);
    endedAt = clock.endedAt;
    roscAccumMs = clock.roscAccumMs;
    cprPausedMs = Math.max(0, pausedAccumMs - clock.roscAccumMs);
  } else if ((status === 'rosc' || status === 'terminated') && endedAt == null) {
    return null;
  }
```

  - In the returned object set `version: 3`, `pausedAccumMs: cprPausedMs`, and add `endedAt, roscAccumMs, training, voided,`.

In `src/engine/store.ts` `toPersisted`, set `version: 3` and add `endedAt: s.endedAt, roscAccumMs: s.roscAccumMs, training: s.training, voided: s.voided,`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/persistence.ts src/engine/persistence.test.ts src/engine/store.ts
git commit -m "feat: session schema v3 (endedAt, roscAccumMs, training, voided) with v1/v2 migration"
```

---

### Task 3: Arrest clock — CPR pauses count, only ROSC excluded

**Files:**
- Modify: `src/engine/timing.ts` (`ClockState` / `CycleClockState` / `masterElapsedMs`)
- Modify: `src/engine/store.ts` (`startCode`, `declareRosc`, `terminateCode`, `reArrest`)
- Modify: `src/components/hud/MasterClock.tsx`
- Modify: `src/components/hud/CyclePanel.tsx`
- Modify: `src/engine/sbar.ts` (`SbarInput` clock fields)
- Test: `src/engine/timing.test.ts`, `src/engine/store.test.ts`, `src/engine/sbar.test.ts`

**Interfaces:**
- Consumes: v3 fields (Task 2).
- Produces:
  - `interface ArrestClockState { startedAt: number | null; endedAt: number | null; roscAccumMs: number }` and `masterElapsedMs(s: ArrestClockState, now: number): number`.
  - `interface CycleClockState { pausedAt: number | null; cycleStartedAt: number | null; cyclePausedAccumMs: number }`.
  - `SbarInput` has `endedAt: number | null; roscAccumMs: number` instead of `pausedAt` / `pausedAccumMs`.

- [ ] **Step 1: Write failing tests**

In `src/engine/timing.test.ts`, replace the whole `describe('masterElapsedMs', ...)` block and the whole `describe('cycleElapsedMs / cycleRemainingMs', ...)` block with:

```ts
describe('masterElapsedMs', () => {
  const run = { startedAt: T0, endedAt: null, roscAccumMs: 0 };

  it('is zero before the code starts', () => {
    expect(masterElapsedMs({ startedAt: null, endedAt: null, roscAccumMs: 0 }, T0)).toBe(0);
  });
  it('counts wall time while running (CPR pauses included)', () => {
    expect(masterElapsedMs(run, T0 + 90_000)).toBe(90_000);
  });
  it('freezes at endedAt (ROSC / termination)', () => {
    expect(masterElapsedMs({ ...run, endedAt: T0 + 30_000 }, T0 + 500_000)).toBe(30_000);
  });
  it('subtracts closed ROSC intervals', () => {
    expect(masterElapsedMs({ ...run, roscAccumMs: 20_000 }, T0 + 80_000)).toBe(60_000);
  });
  it('never goes negative', () => {
    expect(masterElapsedMs({ ...run, roscAccumMs: 1e12 }, T0)).toBe(0);
  });
});

describe('cycleElapsedMs / cycleRemainingMs', () => {
  const base = { pausedAt: null, cyclePausedAccumMs: 0 };

  it('treats a fresh, unstarted cycle as fully elapsed', () => {
    expect(cycleElapsedMs({ ...base, cycleStartedAt: null }, T0)).toBe(CYCLE_MS);
    expect(cycleRemainingMs({ ...base, cycleStartedAt: null }, T0)).toBe(0);
  });
  it('counts down inside the cycle', () => {
    expect(cycleRemainingMs({ ...base, cycleStartedAt: T0 }, T0 + 45_000)).toBe(CYCLE_MS - 45_000);
  });
  it('clamps elapsed at the cycle length', () => {
    const s = { ...base, cycleStartedAt: T0 };
    expect(cycleElapsedMs(s, T0 + 10 * CYCLE_MS)).toBe(CYCLE_MS);
    expect(cycleRemainingMs(s, T0 + 10 * CYCLE_MS)).toBe(0);
  });
  it('is independent of the master clock after a mid-cycle reset', () => {
    expect(masterElapsedMs({ startedAt: T0, endedAt: null, roscAccumMs: 0 }, T0 + 605_000)).toBe(605_000);
    expect(cycleRemainingMs({ ...base, cycleStartedAt: T0 + 600_000 }, T0 + 605_000)).toBe(CYCLE_MS - 5_000);
  });
  it('freezes the cycle while CPR is paused', () => {
    const s = { pausedAt: T0 + 40_000, cyclePausedAccumMs: 0, cycleStartedAt: T0 };
    expect(cycleRemainingMs(s, T0 + 40_000)).toBe(CYCLE_MS - 40_000);
    expect(cycleRemainingMs(s, T0 + 999_999)).toBe(CYCLE_MS - 40_000);
  });
});
```

In `src/engine/store.test.ts`:
- Add `import { masterElapsedMs } from './timing';` at the top.
- Replace the whole `describe('pause / resume timestamps', ...)` block with:

```ts
describe('pause / resume — CPR pauses count as arrest time', () => {
  it('keeps the arrest clock running through a CPR pause', () => {
    s().startCode();
    at(60_000);
    s().pauseCode();
    at(200_000);
    s().resumeCode();
    expect(s().events.find((e) => e.label === 'CPR paused')!.t).toBe(60_000);
    expect(lastEvent().label).toBe('CPR resumed');
    expect(lastEvent().t).toBe(200_000);
    expect(s().pausedAccumMs).toBe(140_000);
  });

  it('includes the paused interval in later events', () => {
    s().startCode();
    at(60_000);
    s().pauseCode();
    at(200_000);
    s().resumeCode();
    at(230_000);
    s().administerEpi();
    expect(lastEvent().t).toBe(230_000);
  });
});

describe('ROSC / termination freeze points', () => {
  it('ROSC while CPR is paused closes the pause and freezes the clock at ROSC', () => {
    s().startCode();
    at(60_000);
    s().pauseCode();
    at(100_000);
    s().declareRosc();
    expect(s().endedAt).toBe(T0 + 100_000);
    expect(s().pausedAccumMs).toBe(40_000);
    expect(masterElapsedMs(s(), T0 + 500_000)).toBe(100_000);
  });

  it('sums two ROSC episodes and logs later events correctly', () => {
    s().startCode();
    at(100_000);
    s().declareRosc();
    at(200_000);
    s().reArrest();
    at(300_000);
    s().declareRosc();
    at(450_000);
    s().reArrest();
    expect(s().roscAccumMs).toBe(250_000);
    at(500_000);
    s().administerEpi();
    expect(lastEvent().t).toBe(250_000);
  });

  it('terminating while CPR is paused freezes at the termination time', () => {
    s().startCode();
    at(60_000);
    s().pauseCode();
    at(90_000);
    s().terminateCode();
    expect(s().endedAt).toBe(T0 + 90_000);
    expect(s().pausedAccumMs).toBe(30_000);
    expect(masterElapsedMs(s(), T0 + 999_000)).toBe(90_000);
    expect(lastEvent().t).toBe(90_000);
  });

  it('terminating from ROSC keeps the clock frozen at ROSC', () => {
    s().startCode();
    at(100_000);
    s().declareRosc();
    at(300_000);
    s().terminateCode();
    expect(s().endedAt).toBe(T0 + 100_000);
    expect(lastEvent().t).toBe(100_000);
  });
});
```

The existing test `'logs re-arrest at the ROSC elapsed time and resumes the clock from there'` must keep passing unchanged (300_000 / 360_000).

In `src/engine/sbar.test.ts`:
- In `base`, replace `pausedAt: T0 + 405_000,` and `pausedAccumMs: 0,` with `endedAt: T0 + 405_000,` and `roscAccumMs: 0,`.
- In the "handles an empty session gracefully" test, replace `pausedAt: null` with `endedAt: null`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/timing.test.ts src/engine/store.test.ts`
Expected: FAIL (old pause-excluding behaviour / type errors).

- [ ] **Step 3: Implement**

`src/engine/timing.ts` — replace `ClockState`, `CycleClockState` and `masterElapsedMs` with:

```ts
export interface ArrestClockState {
  startedAt: number | null;
  /** Freeze point: ROSC or termination time; null while the arrest is ongoing. */
  endedAt: number | null;
  /** Sum of closed ROSC intervals. */
  roscAccumMs: number;
}

export interface CycleClockState {
  pausedAt: number | null;
  cycleStartedAt: number | null;
  cyclePausedAccumMs: number;
}

/**
 * Total arrest time (ms): activation → end (or now) minus ROSC intervals.
 * CPR pauses COUNT — the patient is still in arrest while compressions are paused.
 */
export function masterElapsedMs(s: ArrestClockState, now: number): number {
  if (s.startedAt == null) return 0;
  const ref = s.endedAt ?? now;
  return Math.max(0, ref - s.startedAt - s.roscAccumMs);
}
```

In the clock-model comment above `epiLockoutRemainingMs`, replace the `CodeEvent.t` line with: "`CodeEvent.t` / the master clock are arrest time — CPR pauses included, ROSC periods excluded." Keep the cycle line ("own pause-aware clock").

`src/engine/store.ts`:
- `startCode`: add `endedAt: null, roscAccumMs: 0,` to the returned patch.
- `declareRosc`: keep `at`, `t`, `playChime()`, `haptic.rosc()` and the event. Replace the returned clock fields so it returns:

```ts
        const closesPause = s.status === 'paused' && s.pausedAt != null;
        return {
          status: 'rosc' as SessionStatus,
          endedAt: at,
          pausedAt: s.pausedAt ?? at, // freezes the 2-min cycle
          pausedAccumMs: closesPause ? s.pausedAccumMs + (at - (s.pausedAt as number)) : s.pausedAccumMs,
          metronome: { ...s.metronome, on: false },
          events: [...s.events, /* the existing ROSC_LABEL event, unchanged */],
        };
```

- `terminateCode`: same pattern. Compute `closesPause` the same way and return `endedAt: s.status === 'rosc' ? s.endedAt : at`, `pausedAt: s.pausedAt ?? at`, and `pausedAccumMs` as above. The `status`, `metronome` and `CODE_ENDED_LABEL` event are unchanged.
- `reArrest`: replace the body after the status guard with:

```ts
        const at = clockNow();
        const roscDelta = s.endedAt != null ? Math.max(0, at - s.endedAt) : 0;
        return {
          status: 'active' as SessionStatus,
          pausedAt: null,
          endedAt: null,
          roscAccumMs: s.roscAccumMs + roscDelta,
          cycleStartedAt: at,
          cyclePausedAccumMs: 0,
          cycleIndex: s.cycleIndex + 1,
          events: [...s.events, mkEvent('system', REARREST_LABEL, 'CPR resumed', at, el(s, at))],
        };
```

(`reArrest` no longer adds to `pausedAccumMs`. `pauseCode` and `resumeCode` are unchanged.)

`src/components/hud/MasterClock.tsx`: replace the `pausedAt` and `pausedAccumMs` selectors with:

```ts
  const endedAt = useCodeStore((s) => s.endedAt);
  const roscAccumMs = useCodeStore((s) => s.roscAccumMs);
```

and compute `const elapsed = masterElapsedMs({ startedAt, endedAt, roscAccumMs }, now);`.

`src/components/hud/CyclePanel.tsx`: in the `useShallow` selector remove `startedAt` and `pausedAccumMs`; keep `status`, `cycleIndex`, `pausedAt`, `cycleStartedAt`, `cyclePausedAccumMs`.

`src/engine/sbar.ts`: in `SbarInput`, replace `pausedAt: number | null;` and `pausedAccumMs: number;` with `endedAt: number | null;` and `roscAccumMs: number;`. The `masterElapsedMs(input, now)` call stays.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/timing.ts src/engine/timing.test.ts src/engine/store.ts src/engine/store.test.ts src/engine/sbar.ts src/engine/sbar.test.ts src/components/hud/MasterClock.tsx src/components/hud/CyclePanel.tsx
git commit -m "feat: arrest clock counts CPR pauses; only ROSC periods are excluded"
```

---

### Task 4: Statistics engine (`stats.ts`)

**Files:**
- Create: `src/engine/stats.ts`
- Create: `src/engine/stats.test.ts`
- Modify: `src/engine/store.test.ts` (undo → stats test)
- Modify: `docs/superpowers/specs/2026-10-16-stats-admin-i18n-design.md` (apply the three spec corrections listed at the top)

**Interfaces:**
- Consumes: `masterElapsedMs` (Task 3); `branchFromEvents`, `airwayTypeFromLabel`, `AIRWAY_EVENT_PREFIX`, `RHYTHM_CHECK_PREFIX`, `MAGNESIUM_PREFIX`, `POST_ROSC_PREFIX` (Task 1); `isChecklistItemOn` from `src/engine/checklist.ts`.
- Produces:
  - `STATS_VERSION = 1`
  - `EPI_INTERVAL_FLAG_MS = 300_000`
  - `type Outcome = 'rosc' | 'rosc_then_terminated' | 'terminated' | 'incomplete'`
  - `interface CodeStats` (below)
  - `type StatsInput`
  - `computeCodeStats(s: StatsInput, now: number): CodeStats | null`

- [ ] **Step 1: Write the failing tests** — `src/engine/stats.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { EPI_INTERVAL_FLAG_MS, computeCodeStats, type StatsInput } from './stats';
import { emptySession } from './persistence';
import type { CodeEvent } from './types';

const T0 = 1_700_000_000_000;
const ev = (ms: number, category: CodeEvent['category'], label: string): CodeEvent => ({
  id: `${ms}-${label}`, at: T0 + ms, t: ms, category, label,
});
const dose = (ms: number, label = 'Epinephrine 1 mg IV/IO', mg = 1) => ({ at: T0 + ms, t: ms, label, mg });
const started = (patch: Partial<StatsInput> = {}): StatsInput => ({
  ...emptySession(),
  status: 'active',
  startedAt: T0,
  events: [ev(0, 'system', 'Code Blue activated')],
  ...patch,
});

describe('computeCodeStats', () => {
  it('returns null for a code that never started', () => {
    expect(computeCodeStats(emptySession(), T0)).toBeNull();
  });

  it('classifies each outcome', () => {
    const rosc = [ev(100_000, 'rosc', 'ROSC declared')];
    expect(computeCodeStats(started({ status: 'rosc', endedAt: T0 + 100_000, pausedAt: T0 + 100_000, events: rosc }), T0)!.outcome).toBe('rosc');
    expect(computeCodeStats(started({ status: 'terminated', endedAt: T0 + 100_000, pausedAt: T0 + 100_000, events: rosc }), T0)!.outcome).toBe('rosc_then_terminated');
    expect(computeCodeStats(started({ status: 'terminated', endedAt: T0 + 90_000, pausedAt: T0 + 90_000 }), T0)!.outcome).toBe('terminated');
    expect(computeCodeStats(started(), T0 + 5_000)!.outcome).toBe('incomplete');
  });

  it('measures first shock / first epi from activation in wall-clock time', () => {
    const st = computeCodeStats(
      started({
        shocks: [{ at: T0 + 45_000, t: 45_000, joules: 200, shockable: true }],
        epi: [dose(100_000)],
        events: [
          ev(0, 'system', 'Code Blue activated'),
          ev(10_000, 'rhythm', 'Rhythm branch: Non-shockable (Asystole / PEA)'),
        ],
      }),
      T0 + 200_000,
    )!;
    expect(st.firstShockMs).toBe(45_000);
    expect(st.firstEpiMs).toBe(100_000);
    expect(st.branchAtFirstEpi).toBe('nonshockable');
    expect(st.shocks).toEqual({ count: 1, joules: [200] });
  });

  it('reports "no data" as null, never as 0', () => {
    const st = computeCodeStats(started(), T0 + 60_000)!;
    expect(st.firstShockMs).toBeNull();
    expect(st.firstEpiMs).toBeNull();
    expect(st.branchAtFirstEpi).toBeNull();
    expect(st.epi.meanIntervalMs).toBeNull();
    expect(st.epi.longestIntervalMs).toBeNull();
    expect(st.airway).toEqual({ type: null, firstPlacedMs: null });
    expect(st.postRosc).toBeNull();
  });

  it('computes epinephrine intervals and flags only intervals over 5:00', () => {
    const flagged = computeCodeStats(started({ epi: [dose(0), dose(180_000), dose(600_000)] }), T0 + 700_000)!;
    expect(flagged.epi.meanIntervalMs).toBe(300_000);
    expect(flagged.epi.longestIntervalMs).toBe(420_000);
    expect(flagged.epi.longestExceedsThreshold).toBe(true);
    expect(flagged.epi.flagThresholdMs).toBe(EPI_INTERVAL_FLAG_MS);
    const ok = computeCodeStats(started({ epi: [dose(0), dose(300_000)] }), T0 + 400_000)!;
    expect(ok.epi.longestExceedsThreshold).toBe(false);
  });

  it('includes an open CPR pause in pausedMs', () => {
    const st = computeCodeStats(started({ status: 'paused', pausedAt: T0 + 60_000, pausedAccumMs: 10_000 }), T0 + 90_000)!;
    expect(st.pausedMs).toBe(40_000);
    expect(st.arrestMs).toBe(90_000);
  });

  it('reads airway, rhythms, magnesium, cycles, causes, POCUS and Post-ROSC completion', () => {
    const st = computeCodeStats(
      started({
        status: 'rosc',
        endedAt: T0 + 400_000,
        pausedAt: T0 + 400_000,
        causes: { hypoxia: true, toxins: false },
        pocus: { effusion: true },
        events: [
          ev(0, 'system', 'Code Blue activated'),
          ev(120_000, 'cycle', 'Cycle 1 completed'),
          ev(120_000, 'rhythm', 'Rhythm check — VF'),
          ev(150_000, 'airway', 'Advanced airway placed — Supraglottic airway'),
          ev(200_000, 'drug', 'Magnesium sulfate 1–2 g IV/IO'),
          ev(400_000, 'rosc', 'ROSC declared'),
          ev(410_000, 'post', 'Post-ROSC: 12-lead ECG — STEMI → Cath Lab; decides ICU vs CCU'),
        ],
      }),
      T0 + 500_000,
    )!;
    expect(st.airway).toEqual({ type: 'SGA', firstPlacedMs: 150_000 });
    expect(st.rhythms).toEqual(['VF']);
    expect(st.magnesium.count).toBe(1);
    expect(st.cycles).toBe(1);
    expect(st.causes).toEqual(['hypoxia']);
    expect(st.pocus).toEqual(['effusion']);
    expect(st.postRosc).toEqual({ done: 1, total: 8 });
    expect(st.firstRoscMs).toBe(400_000);
    expect(st.arrestMs).toBe(400_000);
  });

  it('never throws on legacy data with missing arrays', () => {
    const legacy = { ...started(), events: undefined, shocks: undefined, epi: undefined } as unknown as StatsInput;
    expect(() => computeCodeStats(legacy, T0 + 1000)).not.toThrow();
    expect(computeCodeStats(legacy, T0 + 1000)!.shocks.count).toBe(0);
  });
});
```

In `src/engine/store.test.ts`, add `import { computeCodeStats } from './stats';` with the other imports at the top, and append:

```ts
describe('statistics follow undo', () => {
  it('drops an undone epinephrine dose from the stats', () => {
    s().startCode();
    at(60_000);
    s().administerEpi();
    expect(computeCodeStats(s(), T0 + 70_000)!.epi.count).toBe(1);
    s().undoLastEvent();
    expect(computeCodeStats(s(), T0 + 70_000)!.epi.count).toBe(0);
    expect(computeCodeStats(s(), T0 + 70_000)!.firstEpiMs).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/stats.test.ts`
Expected: FAIL — cannot resolve `./stats`.

- [ ] **Step 3: Implement** — `src/engine/stats.ts`

```ts
/**
 * Per-code statistics — pure, derived from the existing session data (no extra tracking).
 * "From activation" times are wall-clock (event.at − startedAt), labelled "as logged".
 * Missing data is null, never a fake 0. Spec: docs/superpowers/specs/2026-10-16-stats-admin-i18n-design.md §4.2.
 */
import type { AirwayType, CauseId, PersistedSession, PocusId, RhythmBranch } from './types';
import { masterElapsedMs } from './timing';
import { isChecklistItemOn } from './checklist';
import {
  AIRWAY_EVENT_PREFIX,
  MAGNESIUM_PREFIX,
  POST_ROSC_PREFIX,
  RHYTHM_CHECK_PREFIX,
  airwayTypeFromLabel,
  branchFromEvents,
} from './eventQueries';
import { CAUSES } from '../content/causes';
import { POCUS_ITEMS } from '../content/pocus';
import { POST_ROSC_BUNDLE } from '../content/protocols';

export const STATS_VERSION = 1;
/** Upper bound of the guideline epinephrine interval ("every 3–5 min"). */
export const EPI_INTERVAL_FLAG_MS = 300_000;

export type Outcome = 'rosc' | 'rosc_then_terminated' | 'terminated' | 'incomplete';

export interface CodeStats {
  statsVersion: number;
  startedAt: number;
  endedAt: number | null;
  arrestMs: number;
  outcome: Outcome;
  roscCount: number;
  firstRoscMs: number | null;
  firstShockMs: number | null;
  firstEpiMs: number | null;
  branchAtFirstEpi: RhythmBranch | null;
  shocks: { count: number; joules: number[] };
  epi: {
    count: number;
    meanIntervalMs: number | null;
    longestIntervalMs: number | null;
    flagThresholdMs: number;
    longestExceedsThreshold: boolean;
  };
  amiodarone: { count: number; totalMg: number };
  lidocaine: { count: number };
  magnesium: { count: number };
  cycles: number;
  pausedMs: number;
  airway: { type: AirwayType | null; firstPlacedMs: number | null };
  rhythms: string[];
  causes: CauseId[];
  pocus: PocusId[];
  postRosc: { done: number; total: number } | null;
}

/** The session fields statistics read (the store state and a PersistedSession both satisfy it). */
export type StatsInput = Pick<
  PersistedSession,
  | 'status' | 'startedAt' | 'endedAt' | 'roscAccumMs' | 'pausedAt' | 'pausedAccumMs'
  | 'events' | 'shocks' | 'epi' | 'amio' | 'lido' | 'causes' | 'pocus'
>;

const list = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

export function computeCodeStats(s: StatsInput, now: number): CodeStats | null {
  if (s.startedAt == null || s.status === 'idle') return null;
  const startedAt = s.startedAt;
  const since = (at: number) => Math.max(0, at - startedAt);

  const events = [...list(s.events)].sort((a, b) => a.at - b.at);
  const shocks = list(s.shocks);
  const epiTimes = list(s.epi).map((d) => d.at).sort((a, b) => a - b);
  const amio = list(s.amio);
  const lido = list(s.lido);

  const roscEvents = events.filter((e) => e.category === 'rosc');
  const roscCount = roscEvents.length;
  const outcome: Outcome =
    s.status === 'rosc'
      ? 'rosc'
      : s.status === 'terminated'
        ? roscCount > 0
          ? 'rosc_then_terminated'
          : 'terminated'
        : 'incomplete';

  const intervals = epiTimes.slice(1).map((t, i) => t - epiTimes[i]);
  const longest = intervals.length ? Math.max(...intervals) : null;
  const firstEpiAt = epiTimes.length ? epiTimes[0] : null;
  const airwayEvent = events.find((e) => e.category === 'airway' && e.label.startsWith(AIRWAY_EVENT_PREFIX));
  const endedAt = s.endedAt ?? null;

  return {
    statsVersion: STATS_VERSION,
    startedAt,
    endedAt,
    arrestMs: masterElapsedMs({ startedAt, endedAt, roscAccumMs: s.roscAccumMs ?? 0 }, now),
    outcome,
    roscCount,
    firstRoscMs: roscEvents.length ? since(roscEvents[0].at) : null,
    firstShockMs: shocks.length ? since(Math.min(...shocks.map((x) => x.at))) : null,
    firstEpiMs: firstEpiAt != null ? since(firstEpiAt) : null,
    branchAtFirstEpi: firstEpiAt != null ? branchFromEvents(events.filter((e) => e.at <= firstEpiAt)) : null,
    shocks: { count: shocks.length, joules: shocks.map((x) => x.joules) },
    epi: {
      count: epiTimes.length,
      meanIntervalMs: intervals.length ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : null,
      longestIntervalMs: longest,
      flagThresholdMs: EPI_INTERVAL_FLAG_MS,
      longestExceedsThreshold: longest != null && longest > EPI_INTERVAL_FLAG_MS,
    },
    amiodarone: { count: amio.length, totalMg: amio.reduce((a, d) => a + (d.mg ?? 0), 0) },
    lidocaine: { count: lido.length },
    magnesium: { count: events.filter((e) => e.category === 'drug' && e.label.startsWith(MAGNESIUM_PREFIX)).length },
    cycles: events.filter((e) => e.category === 'cycle').length,
    pausedMs:
      (s.pausedAccumMs ?? 0) + (s.status === 'paused' && s.pausedAt != null ? Math.max(0, now - s.pausedAt) : 0),
    airway: {
      type: airwayEvent ? airwayTypeFromLabel(airwayEvent.label) : null,
      firstPlacedMs: airwayEvent ? since(airwayEvent.at) : null,
    },
    rhythms: events
      .filter((e) => e.category === 'rhythm' && e.label.startsWith(RHYTHM_CHECK_PREFIX))
      .map((e) => e.label.slice(RHYTHM_CHECK_PREFIX.length)),
    causes: CAUSES.filter((c) => s.causes?.[c.id]).map((c) => c.id),
    pocus: POCUS_ITEMS.filter((p) => s.pocus?.[p.id]).map((p) => p.id),
    postRosc:
      roscCount > 0
        ? {
            done: POST_ROSC_BUNDLE.filter((i) => isChecklistItemOn(events, POST_ROSC_PREFIX, i.text)).length,
            total: POST_ROSC_BUNDLE.length,
          }
        : null,
  };
}
```

Edit the spec `docs/superpowers/specs/2026-10-16-stats-admin-i18n-design.md`:
- **§4.2:**
  - The outcome union becomes `'rosc' | 'rosc_then_terminated' | 'terminated' | 'incomplete'`.
  - The `rosc_rearrest` rule becomes "`rosc_then_terminated` — status `terminated` with `roscCount > 0`".
  - The epi field becomes `flagThresholdMs: number; longestExceedsThreshold: boolean`, with the note "flag = guideline upper bound 5:00 (`EPI_INTERVAL_FLAG_MS`), not the configured lockout (which is the minimum interval)".
- **§4.3:** the session flag `void` becomes `voided`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/stats.ts src/engine/stats.test.ts src/engine/store.test.ts docs/superpowers/specs/2026-10-16-stats-admin-i18n-design.md
git commit -m "feat: pure per-code statistics engine"
```

---

### Task 5: Statistics formatting + SBAR section

**Files:**
- Create: `src/engine/statsFormat.ts`
- Create: `src/engine/statsFormat.test.ts`
- Modify: `src/engine/sbar.ts` (`SbarInput` optional `stats`, `training`, `voided`; new section)
- Modify: `src/components/log/SbarExport.tsx` (`build()` passes stats)
- Test: `src/engine/sbar.test.ts`

**Interfaces:**
- Consumes: `CodeStats`, `Outcome`, `computeCodeStats` (Task 4).
- Produces: `interface StatRow { label: string; value: string; flag?: boolean }`; `statsRows(st: CodeStats): StatRow[]`; `OUTCOME_LABEL: Record<Outcome, string>`; `STATS_TIME_NOTE: string`; `SbarInput.stats?: CodeStats | null`, `SbarInput.training?: boolean`, `SbarInput.voided?: boolean`.

- [ ] **Step 1: Write failing tests** — `src/engine/statsFormat.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { statsRows } from './statsFormat';
import type { CodeStats } from './stats';

const base: CodeStats = {
  statsVersion: 1, startedAt: 0, endedAt: 405_000, arrestMs: 405_000, outcome: 'rosc', roscCount: 1,
  firstRoscMs: 405_000, firstShockMs: 45_000, firstEpiMs: 70_000, branchAtFirstEpi: 'shockable',
  shocks: { count: 2, joules: [200, 360] },
  epi: { count: 3, meanIntervalMs: 200_000, longestIntervalMs: 330_000, flagThresholdMs: 300_000, longestExceedsThreshold: true },
  amiodarone: { count: 1, totalMg: 300 }, lidocaine: { count: 0 }, magnesium: { count: 0 },
  cycles: 3, pausedMs: 12_000, airway: { type: 'SGA', firstPlacedMs: 160_000 },
  rhythms: ['VF', 'pVT'], causes: ['hypoxia'], pocus: ['effusion'], postRosc: { done: 2, total: 8 },
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
      ...base, firstShockMs: null, firstEpiMs: null, branchAtFirstEpi: null, firstRoscMs: null,
      epi: { ...base.epi, count: 0, meanIntervalMs: null, longestIntervalMs: null, longestExceedsThreshold: false },
      airway: { type: null, firstPlacedMs: null }, rhythms: [], causes: [], pocus: [], postRosc: null,
    };
    for (const label of ['First shock', 'First epinephrine', 'First ROSC', 'Advanced airway', 'Rhythms documented', 'Post-ROSC bundle']) {
      expect(row(label, empty).value).toBe('—');
    }
    expect(row('Epinephrine interval (mean / longest)', empty).flag).toBe(false);
  });
});
```

In `src/engine/sbar.test.ts`, add `import { statsRows } from './statsFormat';` and `import { computeCodeStats } from './stats';` with the other imports, and append:

```ts
describe('CODE STATISTICS section', () => {
  it('is omitted without stats and matches statsRows line-for-line when present', () => {
    expect(buildSbar(base, T0 + 500_000)).not.toContain('=== CODE STATISTICS ===');
    const stats = computeCodeStats({ ...base, pausedAt: base.endedAt, pausedAccumMs: 0 }, T0 + 500_000)!;
    const text = buildSbar({ ...base, stats, training: true }, T0 + 500_000);
    expect(text).toContain('=== CODE STATISTICS ===');
    expect(text).toContain('TRAINING / SIMULATION');
    expect(text).toContain('Times are from code activation, as logged.');
    for (const r of statsRows(stats)) expect(text).toContain(`${r.label}: ${r.value}`);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/statsFormat.test.ts src/engine/sbar.test.ts`
Expected: FAIL — `./statsFormat` not found.

- [ ] **Step 3: Implement** — `src/engine/statsFormat.ts`

```ts
/** Single source of truth for how statistics read — used by the UI panel AND the SBAR so they never disagree. */
import type { CodeStats, Outcome } from './stats';
import { formatClock } from './timing';
import { CAUSES } from '../content/causes';
import { POCUS_ITEMS } from '../content/pocus';

export interface StatRow {
  label: string;
  value: string;
  /** neutral fact worth a second look (e.g. epi interval over 5:00) */
  flag?: boolean;
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  rosc: 'ROSC achieved',
  rosc_then_terminated: 'ROSC achieved, later terminated',
  terminated: 'Terminated without ROSC',
  incomplete: 'Incomplete (code not ended)',
};

export const STATS_TIME_NOTE = 'Times are from code activation, as logged.';

const DASH = '—';
const time = (ms: number | null) => (ms == null ? DASH : formatClock(ms));
const listOr = (items: string[]) => (items.length ? items.join(', ') : DASH);

export function statsRows(st: CodeStats): StatRow[] {
  return [
    {
      label: 'Outcome',
      value: OUTCOME_LABEL[st.outcome] + (st.roscCount > 1 ? ` (${st.roscCount} ROSC episodes)` : ''),
    },
    { label: 'Arrest time (ROSC periods excluded)', value: time(st.arrestMs) },
    { label: 'First ROSC', value: time(st.firstRoscMs) },
    { label: 'First shock', value: time(st.firstShockMs) },
    {
      label: 'First epinephrine',
      value:
        st.firstEpiMs == null
          ? DASH
          : `${time(st.firstEpiMs)}${
              st.branchAtFirstEpi ? ` (${st.branchAtFirstEpi === 'shockable' ? 'shockable' : 'non-shockable'} branch)` : ''
            }`,
    },
    {
      label: 'Shocks',
      value: st.shocks.count ? `${st.shocks.count} (${st.shocks.joules.map((j) => `${j}J`).join(', ')})` : '0',
    },
    { label: 'Epinephrine doses', value: String(st.epi.count) },
    {
      label: 'Epinephrine interval (mean / longest)',
      value: st.epi.meanIntervalMs == null ? DASH : `${time(st.epi.meanIntervalMs)} / ${time(st.epi.longestIntervalMs)}`,
      flag: st.epi.longestExceedsThreshold,
    },
    {
      label: 'Amiodarone',
      value: st.amiodarone.count ? `${st.amiodarone.count} (${st.amiodarone.totalMg} mg)` : '0',
    },
    { label: 'Lidocaine doses', value: String(st.lidocaine.count) },
    { label: 'Magnesium doses', value: String(st.magnesium.count) },
    { label: 'CPR cycles completed', value: String(st.cycles) },
    { label: 'Time logged as paused', value: time(st.pausedMs) },
    {
      label: 'Advanced airway',
      value:
        st.airway.type == null
          ? DASH
          : `${st.airway.type === 'SGA' ? 'Supraglottic airway' : 'ETT'} at ${time(st.airway.firstPlacedMs)}`,
    },
    { label: 'Rhythms documented', value: listOr(st.rhythms) },
    { label: "H's & T's addressed", value: listOr(CAUSES.filter((c) => st.causes.includes(c.id)).map((c) => c.label)) },
    { label: 'POCUS findings', value: listOr(POCUS_ITEMS.filter((p) => st.pocus.includes(p.id)).map((p) => p.label)) },
    { label: 'Post-ROSC bundle', value: st.postRosc ? `${st.postRosc.done}/${st.postRosc.total} recorded` : DASH },
  ];
}
```

`src/engine/sbar.ts`:
- Add `import type { CodeStats } from './stats';` and `import { STATS_TIME_NOTE, statsRows } from './statsFormat';`.
- Add to `SbarInput`:

```ts
  /** Per-code statistics; the section is omitted when absent. */
  stats?: CodeStats | null;
  training?: boolean;
  voided?: boolean;
```

- Insert directly after the ASSESSMENT block's closing `out.push('');` and before the `if (rosc) {` POST-ROSC CARE block:

```ts
  if (input.stats) {
    out.push('=== CODE STATISTICS ===');
    if (input.training) out.push('TRAINING / SIMULATION — not a real patient');
    if (input.voided) out.push('VOIDED — excluded from statistics');
    out.push(`(${STATS_TIME_NOTE})`);
    for (const r of statsRows(input.stats)) out.push(`${r.label}: ${r.value}${r.flag ? ' ⚠ over 5:00' : ''}`);
    out.push('');
  }
```

`src/components/log/SbarExport.tsx`: add `import { computeCodeStats } from '../../engine/stats';` and replace `build` with:

```ts
  const build = () => {
    const st = useCodeStore.getState();
    const now = Date.now();
    return buildSbar({ ...st, stats: computeCodeStats(st, now) }, now);
  };
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/statsFormat.ts src/engine/statsFormat.test.ts src/engine/sbar.ts src/engine/sbar.test.ts src/components/log/SbarExport.tsx
git commit -m "feat: code statistics section in the SBAR from a shared formatter"
```

---

### Task 6: Training/Void actions + Code statistics panel

**Files:**
- Modify: `src/engine/store.ts` (actions `setTraining`, `setVoided`)
- Create: `src/components/log/CodeStatsPanel.tsx`
- Modify: `src/screens/LogScreen.tsx`
- Test: `src/engine/store.test.ts`

**Interfaces:**
- Consumes: `computeCodeStats` (Task 4); `statsRows`, `STATS_TIME_NOTE` (Task 5); `Panel` (`title`, `icon`, `accent: 'none'|'crit'|'warn'|'cyber'|'good'`, `className`), `Chip` (`selected`, `onClick`, children), `HoldButton` (`label`, `sub`, `onComplete`, `durationMs`, `variant`), `useNow()`.
- Produces: `CodeStore.setTraining(on: boolean): void`, `CodeStore.setVoided(on: boolean): void`, `<CodeStatsPanel />`.

- [ ] **Step 1: Write failing test** — append to `src/engine/store.test.ts`:

```ts
describe('training / void flags', () => {
  it('sets the flags and clears them on New code', () => {
    s().startCode();
    s().setTraining(true);
    s().setVoided(true);
    expect(s().training).toBe(true);
    expect(s().voided).toBe(true);
    s().reset();
    expect(s().training).toBe(false);
    expect(s().voided).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/store.test.ts`
Expected: FAIL — `setTraining is not a function`.

- [ ] **Step 3: Implement**

`src/engine/store.ts` — add to `interface CodeStore`:

```ts
  setTraining: (on: boolean) => void;
  setVoided: (on: boolean) => void;
```

and to the store object, next to `setSetting`:

```ts
    setTraining: (on) => apply(() => ({ training: on })),
    setVoided: (on) => apply(() => ({ voided: on })),
```

Create `src/components/log/CodeStatsPanel.tsx`:

```tsx
import { BarChart3 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import { computeCodeStats } from '../../engine/stats';
import { STATS_TIME_NOTE, statsRows } from '../../engine/statsFormat';
import { Panel } from '../ui/Panel';
import { Chip } from '../ui/Chip';
import { HoldButton } from '../ui/HoldButton';

/** End-of-code statistics (same rows as the SBAR section) plus Training / Void flags. */
export function CodeStatsPanel() {
  const now = useNow();
  const session = useCodeStore(
    useShallow((s) => ({
      status: s.status, startedAt: s.startedAt, endedAt: s.endedAt, roscAccumMs: s.roscAccumMs,
      pausedAt: s.pausedAt, pausedAccumMs: s.pausedAccumMs, events: s.events, shocks: s.shocks,
      epi: s.epi, amio: s.amio, lido: s.lido, causes: s.causes, pocus: s.pocus,
    })),
  );
  const training = useCodeStore((s) => s.training);
  const voided = useCodeStore((s) => s.voided);
  const setTraining = useCodeStore((s) => s.setTraining);
  const setVoided = useCodeStore((s) => s.setVoided);

  const stats = computeCodeStats(session, now);
  if (!stats) return null;

  return (
    <Panel title="Code statistics" icon={BarChart3} accent={voided ? 'none' : 'cyber'} className={voided ? 'opacity-60' : ''}>
      {voided ? (
        <p className="mb-2 rounded-lg border border-line px-3 py-2 text-xs font-bold text-mute">
          VOIDED — kept on record, excluded from statistics
        </p>
      ) : null}
      <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {statsRows(stats).map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 rounded-lg border border-line bg-panel2/60 px-3 py-2">
            <dt className="text-xs text-mute">{r.label}</dt>
            <dd className={`tnum text-end text-sm font-bold ${r.flag ? 'text-warn' : 'text-ink'}`}>
              {r.value}
              {r.flag ? ' ⚠' : ''}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-mute">{STATS_TIME_NOTE}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Chip selected={training} onClick={() => setTraining(!training)}>
          {training ? 'Training / simulation ✓' : 'Mark as training'}
        </Chip>
        {voided ? (
          <Chip selected onClick={() => setVoided(false)}>
            Restore (un-void)
          </Chip>
        ) : (
          <HoldButton
            variant="outline"
            label="Void this code"
            sub="Hold 2 s — keeps it, excludes from stats"
            durationMs={2000}
            onComplete={() => setVoided(true)}
          />
        )}
      </div>
    </Panel>
  );
}
```

`src/screens/LogScreen.tsx`: add `import { CodeStatsPanel } from '../components/log/CodeStatsPanel';` and render `<CodeStatsPanel />` as the first child of the outer `div`, above `<SbarExport />`.

- [ ] **Step 4: Run tests, typecheck and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/engine/store.ts src/engine/store.test.ts src/components/log/CodeStatsPanel.tsx src/screens/LogScreen.tsx
git commit -m "feat: code statistics panel with training and void flags"
```

---

### Task 7: One-time notice about the clock change

**Files:**
- Create: `src/components/ui/ClockChangeNotice.tsx`
- Modify: `src/App.tsx` (render it at the top of `<main>`)
- Modify: `README.md` (short "Arrest clock" section)

**Interfaces:**
- Consumes: `STORAGE_KEY` from `src/engine/persistence.ts`.
- Produces: `<ClockChangeNotice />`.

- [ ] **Step 1: Implement** — `src/components/ui/ClockChangeNotice.tsx`

```tsx
import { useState } from 'react';
import { STORAGE_KEY } from '../../engine/persistence';

const NOTICE_KEY = 'resuscode.notice.arrestClockV3';

/** Shown once to existing users (a saved session exists); fresh installs never see it. */
function alreadySeen(): boolean {
  try {
    if (window.localStorage.getItem(NOTICE_KEY) === '1') return true;
    if (window.localStorage.getItem(STORAGE_KEY) == null) {
      window.localStorage.setItem(NOTICE_KEY, '1');
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function ClockChangeNotice() {
  const [show, setShow] = useState(() => !alreadySeen());
  if (!show) return null;
  const dismiss = () => {
    try {
      window.localStorage.setItem(NOTICE_KEY, '1');
    } catch {
      /* storage blocked — just hide */
    }
    setShow(false);
  };
  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-cyber/60 bg-cyber/10 p-3 text-xs font-semibold text-cyber">
      <span className="flex-1">
        Update: the arrest clock now keeps running while CPR is paused — only ROSC periods are excluded.
      </span>
      <button type="button" onClick={dismiss} className="touch-hit rounded-lg border border-cyber/60 px-3 py-2 font-bold">
        Got it
      </button>
    </div>
  );
}
```

In `src/App.tsx`: `import { ClockChangeNotice } from './components/ui/ClockChangeNotice';` and render `<ClockChangeNotice />` as the first child of `<main>`, before the `restored` banner.

In `README.md`, append:

```markdown
## Arrest clock

Total arrest time runs from code activation to the end of the code. Time logged as **CPR paused counts** (the patient is still in arrest); only **ROSC periods** are excluded. The 2-minute CPR cycle timer still pauses with CPR. Statistics report "time logged as paused" separately, and all statistic times are from activation, as logged.
```

- [ ] **Step 2: Typecheck, test and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ClockChangeNotice.tsx src/App.tsx README.md
git commit -m "feat: one-time notice explaining the arrest clock change"
```

---

### Task 8: End-to-end verification in the browser

**Files:** none (verification only; any fix goes into the owning task's files with its own test).

- [ ] **Step 1: Full suite and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: all green.

- [ ] **Step 2: Browser checks** (`preview_start` → `resuscode-dev`, phone-width viewport)
1. START CODE → Pause → wait ~5 s: the master clock keeps counting and the cycle timer stops. Resume.
2. Log a shock and an epi → ROSC (hold) → the clock freezes. On Log/SBAR, the "Code statistics" panel shows Outcome "ROSC achieved", first shock and first epi times, and Post-ROSC "0/8 recorded".
3. Tick a Post-ROSC item → the panel shows "1/8 recorded".
4. Open the SBAR preview/copy → `=== CODE STATISTICS ===` shows the same values as the panel.
5. Mark as training → the SBAR shows "TRAINING / SIMULATION". Hold "Void this code" → the panel dims and shows VOIDED; "Restore" clears it.
6. Seed a v2 session in `localStorage` with a ROSC → Re-arrest pair, then reload → the clock excludes the ROSC interval. The one-time notice appears; dismiss it and reload, and it stays gone.
7. The console has no errors apart from the known `navigator.vibrate` gesture warnings.

- [ ] **Step 3: Report**

List each check as pass/fail with a screenshot of the statistics panel. Push/deploy to `main` happens only on the user's go-ahead.
