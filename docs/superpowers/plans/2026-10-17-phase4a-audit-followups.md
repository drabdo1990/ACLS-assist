# Phase 4a audit follow-ups — Implementation Plan

> Executed with superpowers:subagent-driven-development. One fresh implementer per task, task review after each, one whole-branch review at the end.

**Goal:** Fix the audit findings that PR #7 lists under "Still open" and that need no clinical or policy decision.

**Spec:** `docs/superpowers/specs/2026-10-16-pals-4a-design.md` (binding where it speaks). The audit itself is recorded in the PR #7 description.

**Branch:** `phase4a-pediatric` (already pushed; do NOT push — the controller asks first).

## Global Constraints

- **TDD, no exceptions:** write the failing test first, run it, watch it fail for the expected reason, then write the minimal fix. Report RED and GREEN command output.
- **Adult behaviour must not change.** The golden suites (`src/content/adult.golden.test.ts`, `src/engine/eventKeys.test.ts`) must stay green untouched.
- **No invented clinical content.** Pediatric text may only reuse values already present in `src/content/profiles/pediatric.ts` or the existing `pPostRosc.*` / `p.*` keys. Where a value is not there, use neutral wording with no number.
- **All user-visible strings go through i18n:** add every new key to BOTH `src/i18n/en.ts` and `src/i18n/ar.ts`; Arabic entries carry the trailing comment `// draft — clinician review required`. `src/i18n/i18n.test.ts` and `src/i18n/hardcodedTextGuard.test.ts` enforce parity and no hard-coded JSX text.
- **No physical left/right Tailwind classes** (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`): use logical ones (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`). `src/i18n/rtlClasses.test.ts` enforces it.
- **Verification before each commit:** `npx tsc --noEmit` clean and `npx vitest run` fully green (currently 408 tests). Report the counts.
- **Vitest is node-only (no DOM).** Component behaviour is tested by extracting pure logic into a small module with unit tests, or by source-level guards (see `src/components/hud/profileRouting.test.ts`). Do not add jsdom or any new dependency.
- **A repo hook (GateGuard) blocks the first Edit/Write of each file until you state, in plain text before the call, the file's importers, the affected API, any data structure touched, and the user's request verbatim; then retry the same call.** The user's request is: "fix them first".
- Commit with a conventional message (`fix(scope): …`) and a body saying what was wrong. Never `git push`. Never amend or rebase existing commits.
- Do not touch files unrelated to your task. Do not dispatch subagents.

## Out of scope (ruled out before execution)

Needs the owner's clinical or policy decision, or visual verification, so it is not in this plan: the 15 mg/kg amiodarone cumulative warning wording (`exceedsTotal`), consent/privacy copy about pediatric weight/age, enrollment-link confirm screen, server-side cross-unit `record_id` overwrite, outbox retry caps and stranded `queued` records, unweighted-epi totals in the ROSC/SBAR text, Arabic bidi isolation of dose ranges, static `index.html`/manifest "Adult ACLS" text, and strengthening `hardcodedTextGuard` (it would flag many existing strings).

### Task 1: Clamp pause/resume time deltas so a backward clock step cannot corrupt a session

**Problem.** `src/engine/store.ts` `resumeCode` computes `const delta = s.pausedAt != null ? at - s.pausedAt : 0` with no lower bound; `declareRosc` and `terminateCode` use the same unclamped `at - s.pausedAt`. (`reArrest` already clamps — copy its approach.) If the wall clock steps backward by more than the time since the pause, `delta` is negative, `pausedAccumMs` / `cyclePausedAccumMs` / `roscAccumMs` go negative, `sanitizeSession` in `src/engine/persistence.ts` (the `nonNegative` checks) rejects the whole session, and the live code is quarantined at the next boot.

**Required behaviour.**
- A negative pause delta is treated as 0 in `resumeCode`, `declareRosc` and `terminateCode` (any place in `store.ts` that subtracts `pausedAt` from `at`; grep for `pausedAt`).
- After pause → system clock moved back by more than the pause duration → resume/declareRosc/terminate, every accumulated field is `>= 0`, and `sanitizeSession(JSON round-trip of the persisted shape)` returns a non-null session.
- Behaviour with a normal (forward) clock is unchanged; existing `store.test.ts`, `timing.test.ts`, `clock.test.ts` stay green.

**Tests (write first).** Add to `src/engine/store.test.ts` (it already mocks `./clock` and uses fake timers — follow its pattern). Three cases (resume, declareRosc while paused, terminateCode while paused), each: start code, pause, move system time to BEFORE the pause instant, perform the action, assert `pausedAccumMs`/`cyclePausedAccumMs` (and `roscAccumMs` for ROSC) `>= 0`; and one case asserting `sanitizeSession` accepts the resulting persisted state (use the store's `toPersisted`-equivalent path as the existing persistence tests do, or `useCodeStore.getState()` fields spread into `emptySession()` shape).

**Files.** Modify `src/engine/store.ts`; test in `src/engine/store.test.ts`.

### Task 2: A Training/Void edit made in History must survive "New code" (reset)

**Problem.** `editRecordFlags` (`src/engine/history.ts`, around line 152-160) changes only the stored record. `src/engine/historyCapture.ts` `handle()` (lines ~68-75): when `reset()` replaces the state, it calls `record(prev)`, rebuilding the record from the old session's flags; `upsertRecord` sees a different `dataKey`, replaces the stored record (discarding the user's edit) and sets it back to `queued`, so it re-uploads with the original flags. Trigger: code ends → Log → History → mark the new record Training/Void → hold Reset on the same screen.

**Required behaviour.**
- If the user edits Training/Void for the record that belongs to the *currently terminal live session* (record id starts with the live session's `startedAt`), the edit is also applied to the live session (`setTraining` / `setVoided` in the store), so any later capture of that session carries the edited flags. The record stays consistent whether the capture is the debounced one or the reset-time one.
- Editing a record that is NOT the live session's (older codes) behaves exactly as today.
- After the edit and a reset, the stored record has the edited flags and its upload status reflects one re-queue at most (it must not flip back to the original flags).
- Put the "does this record belong to the live session" decision in a small pure function with unit tests; the UI (`src/components/log/RecordDetail.tsx`, which calls `editRecordFlags` at lines ~26 and ~39) calls it. Do not change the stored record schema.

**Tests (write first).** In `src/engine/historyCapture.test.ts` (look at how it drives capture with a fake store/KV) add an interaction test: terminal session captured → apply the flag edit through the same code path the UI will use → reset → read the stored record → flags are the edited ones. Plus unit tests for the pure ownership function (matches live session; does not match an older record; no live session).

**Files.** Modify `src/engine/historyCapture.ts` and/or `src/engine/history.ts` as needed, `src/components/log/RecordDetail.tsx`; tests in `src/engine/historyCapture.test.ts` (+ a small test file for the pure function if you create one).

### Task 3: No adult-only text in pediatric mode

**Problem.** Three adult strings show during a pediatric code:
1. `src/screens/HudScreen.tsx` (~lines 34-35): the ROSC banner shows "MAP ≥ 65 · SpO₂ 92–98% · TTM" regardless of population. The pediatric post-ROSC targets already exist in `src/content/profiles/pediatric.ts` (`postRoscBundle`) and the `pPostRosc.*` keys in `en.ts` (SpO₂ 94–99%, SBP below the 5th centile).
2. `src/components/hud/InterventionGrid.tsx` (~line 207): the epinephrine sub-line key `hud.grid.epi.flush` reads "IV/IO + 20 mL NS flush" at any weight.
3. `src/App.tsx` (~line 88): the header shows `t('app.title')` = "Adult ACLS Command" also in pediatric mode.

**Required behaviour.**
- Pediatric population: ROSC banner uses the pediatric targets taken from the existing pediatric content (reuse the existing keys if one concise key exists; otherwise add a new key whose text uses only the SpO₂ and SBP values already present in `pediatric.ts`/`pPostRosc.*` — no new numbers, no MAP/TTM adult targets).
- Pediatric population: epinephrine sub-line reads "IV/IO + saline flush" (no volume — a flush volume is a clinical value not in the content). New key e.g. `peds.grid.epi.flush`.
- Pediatric population: header title reads "Pediatric PALS Command" (new key e.g. `app.title.pediatric`); adult keeps `app.title` unchanged.
- Adult output is byte-for-byte unchanged for all three (adult keys and rendering untouched). New keys exist in en AND ar (Arabic draft comment).
- Choose the population from the store (`useCodeStore((s) => s.population)`), as `RhythmBranch.tsx` now does.

**Tests (write first).** The suite is node-only: extract the small selection logic into a pure helper (e.g. `src/components/hud/populationText.ts` exporting functions that return the message KEY for a population, for the three strings) and unit-test it (adult returns the existing adult keys; pediatric returns the new/pediatric keys; every returned key exists in `en.ts` — import the dictionary and assert). Add a source-level guard (like `profileRouting.test.ts`) asserting `App.tsx`, `HudScreen.tsx`, `InterventionGrid.tsx` no longer pass the adult key unconditionally for these three strings (e.g. they call the helper). Then wire the components.

**Files.** Create `src/components/hud/populationText.ts` + test; modify `src/screens/HudScreen.tsx`, `src/components/hud/InterventionGrid.tsx`, `src/App.tsx`, `src/i18n/en.ts`, `src/i18n/ar.ts`.

### Task 4: HoldButton operable by keyboard and assistive tech; no timer leak on unmount

**Problem.** `src/components/ui/HoldButton.tsx` (lines ~97-104) handles only `onPointerDown/Up/Cancel/Leave`: no `onKeyDown`/`onKeyUp`/`onClick`. Keyboard, switch-access and screen-reader users can never trigger ROSC, End code, New code, Void or Clear history. It also has no unmount cleanup for its `requestAnimationFrame` loop and its 250 ms `setTimeout` (lines ~54-87), so unmounting mid-hold can still call `onComplete`.

**Required behaviour.**
- Holding Space or Enter on the focused button starts the same hold as a pointer press and completes after the same duration (reuse the existing duration constant); releasing early (keyup, or blur) cancels exactly like pointer-up/cancel. Ignore auto-repeat keydown events (`event.repeat`). Prevent default scrolling for Space.
- Pointer behaviour is unchanged.
- Unmounting during a hold cancels the rAF and the timeout and never calls `onComplete`.
- Add an accessible description (use an existing i18n key if there is a suitable "hold to confirm" string; otherwise add one to en+ar) so assistive tech announces that the control must be held.
- Extract the hold state machine (start / cancel / progress at time t / complete decision, input-agnostic) into a pure module, e.g. `src/components/ui/holdLogic.ts`, and unit-test it. The component wires pointer and keyboard to that module.

**Tests (write first).** Unit tests for the pure module: completes only after the full duration; early release cancels and never completes; a second start while holding is ignored; progress is clamped 0–1; cancel after complete is a no-op. Add a source-level guard asserting `HoldButton.tsx` contains `onKeyDown`, `onKeyUp` and an unmount cleanup (`return () =>` inside a `useEffect`).

**Files.** Create `src/components/ui/holdLogic.ts` + test; modify `src/components/ui/HoldButton.tsx` (and `en.ts`/`ar.ts` only if a new key is needed).

### Task 5: Wake lock — retry after a failed first request; never leak a sentinel

**Problem.** `src/engine/wakeLock.ts` (lines ~45-73): (a) the `visibilitychange` re-acquire listener is attached only inside the `try`, after the first successful `request()`, so if the first request throws (low-battery mode, or opened while hidden) the lock is never re-acquired until the caller toggles; (b) two concurrent `requestWakeLock()` calls before the first `request()` resolves overwrite the sentinel variable, leaking the first one so the screen stays awake after the code ends; (c) `releaseWakeLock()` during an in-flight acquire is overridden when that acquire resolves.

**Required behaviour.**
- The visibility listener is registered as soon as a lock is *wanted* (and removed when released), independent of whether the first request succeeded; on becoming visible while still wanted and not held, it retries.
- Concurrent `requestWakeLock()` calls share one in-flight acquisition; at most one live sentinel exists.
- If `releaseWakeLock()` is called while an acquire is in flight, the sentinel obtained when it resolves is released immediately and the module ends in the released state.
- Public API (exported names and signatures) unchanged; `src/hooks/useWakeLock.ts` keeps working unmodified.

**Tests (write first).** Create `src/engine/wakeLock.test.ts` (node env): stub `globalThis.navigator.wakeLock` with a fake whose `request()` is controllable (resolve/reject on demand, returns a sentinel with `release()` and a `released` flag/listeners), and stub `document.visibilityState`/`addEventListener` minimally (a tiny fake `document` on `globalThis`). Cases: first request rejects then visibility→visible retries and acquires; two concurrent requests → `request` called once, one sentinel; release during in-flight acquire → resolved sentinel is released and nothing stays held; release removes the listener. Read the module first to see which globals it touches and fake exactly those.

**Files.** Modify `src/engine/wakeLock.ts`; create `src/engine/wakeLock.test.ts`.

### Task 6: Translate the hard-coded header wake-lock chip and the Asystole/Pulse buttons

**Problem.** `src/App.tsx` (~lines 93-108) hard-codes English: chip titles "Screen will not sleep" / "Wake lock idle" / "Wake Lock unsupported on this browser" and chip text "AWAKE" / "IDLE" / "N/A". `src/components/hud/CyclePanel.tsx` (~lines 28 and 157) hard-codes the "Asystole" and "Pulse" button labels. `hardcodedTextGuard.test.ts` misses them because they sit inside ternaries / are passed as props. In Arabic mode these stay English.

**Required behaviour.**
- Every one of those strings is rendered through `t()` with new keys in en AND ar (Arabic draft comment); English text is unchanged (same words and casing as today).
- Task 3 has already modified `src/App.tsx` (header title) — read the current file and keep that change.
- No other behaviour changes.

**Tests (write first).** A source-level guard test (new file `src/i18n/headerChips.test.ts`) asserting `App.tsx` no longer contains the literals `'AWAKE'`, `'IDLE'`, `'N/A'`, `'Screen will not sleep'`, `'Wake lock idle'`, `'Wake Lock unsupported on this browser'` and `CyclePanel.tsx` no longer contains the literals `'Asystole'` / `'Pulse'` as JSX/label text — and that the new keys exist in `en.ts` with the exact old English text (import the dictionary). Run it red, then wire the components.

**Files.** Modify `src/App.tsx`, `src/components/hud/CyclePanel.tsx`, `src/i18n/en.ts`, `src/i18n/ar.ts`; create `src/i18n/headerChips.test.ts`.
