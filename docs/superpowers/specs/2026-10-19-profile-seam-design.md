# Finish the protocol-profile seam (architecture survey finding 1): design

**Status:** approved by the user (2026-10-19); implementation plan not yet written. Scope is **finding 1 only**. Behavior-preserving refactor: no dose, label, audit-trail string or UI text may change.

## 1. Context
Phase 4a added `ProtocolProfile` (`src/content/profiles/index.ts`, `adult.ts`, `pediatric.ts`) so one HUD serves adult and pediatric codes. The UI uses it (`InterventionGrid.tsx:82`, `MetronomeCard.tsx:20`, `RhythmBranch.tsx:32`), but the seam is only half used:

- **Store bypass.** `store.ts:512`, `579`, `620` and `677` branch on `population === 'pediatric'` and call `profileFor('pediatric')`. The adult path is hand-built from `calc.ts` (`store.ts:598`, `641-645`), so `adultProfile` is never consulted for events.
- **Grid duplication.** `InterventionGrid.tsx:137-138` and `:161` compute adult doses directly (`lidocaineDose`, `lidocaineBudget`, `amiodaroneDoseMg`).
- **Bundle ternaries.** `sbar.ts:253`, `stats.ts:191` and `PostRoscBundle.tsx:19` each re-implement `peds ? PEDIATRIC_POST_ROSC_BUNDLE : POST_ROSC_BUNDLE`, although `profile.postRoscBundle` exists.
- **Safety trap.** `adultProfile` hard-codes `exceedsTotal: false` and takes no dose history, so the adult 3 mg/kg lidocaine warning lives only in the store and the grid. Routing the store through the current adult profile would silently drop that warning. The contract must be extended first.
- **Friction evidence.** Population checks appear in 16 non-test files, and several recent commits are pediatric fixes to `InterventionGrid` (`c7b79c5`, `3a2639d`, `e250301`).

## 2. Goal and non-goals
**Goal:** the profile owns all dose arithmetic for both populations; one pure module owns dose-event wording; no caller re-implements the adult/pediatric choice.

**Non-goals:**
- audio/haptics inside store updaters (finding 2);
- enrollment/prefs cleanup (finding 3);
- the pediatric cumulative-dose quirk (see §3);
- any Arabic wording or UI text.

## 3. Profile contract changes (`content/profiles`)
- `amiodarone(weightKg, doseIndex, givenMg)` and `lidocaine(weightKg, doseIndex, givenMg)` gain `givenMg: readonly number[]`, the doses already logged.
- **Adult lidocaine** is computed in `adult.ts` with the existing `lidocaineDose` and `lidocaineBudget`, returning today's numbers. The result gains `doseNo`, `cumulativeMg` and `maxTotalMg`, and `exceedsTotal` becomes the real rule (`nextExceeds`). The 70 kg default stays inside `adult.ts`.
- **Adult amiodarone** keeps 300 mg then 150 mg through `amiodaroneDoseMg`.
- **Pediatric** ignores `givenMg`, so no pediatric value changes.
  - Known quirk, logged as a follow-up and not fixed here: after a mid-code weight correction, the index-based cumulative total (`pediatric.ts:119`, `:163`) can misstate earlier doses.
- **Adult epinephrine, magnesium and shock** already return the right values and need no change.
- `profile.postRoscBundle` becomes the only source of the bundle. `sbar.ts`, `stats.ts` and `PostRoscBundle.tsx` stop importing `PEDIATRIC_POST_ROSC_BUNDLE`.

## 4. `src/engine/doseEvents.ts` (new, pure)
`epiEvent`, `amioEvent`, `lidoEvent` and `magEvent`. Each takes the population, the profile result, `n` and `kg`, and returns `{ label, detail, i18n, mg }`.
- It reuses the existing keys (`ev.epi`, `ev.pedsEpi`, `ev.pedsEpi.noWeight`, `ev.amio`, `ev.pedsAmio.noWeight`, `ev.lido`, `ev.pedsLido`, `ev.lido.detailExceeds`, `ev.mag`, `ev.pedsMag` and their detail keys) through the existing `keyed()`, so strings are unchanged.
- Pediatric with no weight returns the "no weight" event with `mg: null`, as today.
- It imports nothing from the store or React, so it is unit-testable in Node.

## 5. Wiring
- **`store.ts`:** `administerEpi`, `administerAmiodarone`, `administerLidocaine` and `administerMagnesium` call `profileFor(s.population)` plus `doseEvents`, passing the logged mg list. This removes the `amiodaroneDoseMg`, `lidocaineDose` and `lidocaineBudget` imports and every population branch. `deliverShock` and the audio/haptic lines are untouched.
- **`InterventionGrid.tsx`:** lines 137-138 and 161 read profile results instead of `calc.ts`. UI labels and wording stay as they are.
- **Bundle readers:** `sbar.ts:253`, `stats.ts:191` and `PostRoscBundle.tsx:19` use `profileFor(population).postRoscBundle`.

## 6. Testing (characterization first)
1. **Profile tests:** adult `lidocaine` and `amiodarone` equal the existing `calc.ts` outputs for dose indexes 0–5 across several weights, including where `nextExceeds` flips. The existing `pediatric.test.ts` passes untouched.
2. **Golden suites:** `eventKeys.test.ts` with `goldenEvents.json`, and `adult.golden.test.ts`, pass **unchanged**. If any golden needs editing, stop and report, because a dose or wording changed.
3. **`doseEvents.test.ts`:** every drug, adult and pediatric, with and without weight, including the adult "exceeds 3 mg/kg" detail.
4. **Grid:** its labels are computed inside the component and can't be tested in Node. Compare button text before and after in the browser, for adult and pediatric.
5. **Full run:** the suite (480 tests), `tsc` and the build, with `TZ` pinned as CI does.

## 7. Rollout
Branch `refactor/profile-seam`, three commits:
1. profile contract plus tests, no callers changed;
2. store plus `doseEvents`;
3. grid plus bundle readers.

Then push and open a PR. The user merges, which triggers the deploy.

## 8. Risks
- **Clinical dose path.** The safeguard is the golden suites staying unchanged.
- **The adult lidocaine warning.** It must be covered by an explicit test before the store is touched.
- **`store.ts` has 27 importers.** Keep each commit green on its own.
