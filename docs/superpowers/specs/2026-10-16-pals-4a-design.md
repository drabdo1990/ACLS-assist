# Phase 4a — Pediatric mode foundation + pediatric cardiac arrest: design

**Status:** design approved section by section (2026-10-16); this written spec awaits review.
**Builds on:** phases 1–3 (`2026-10-16-stats-admin-i18n-design.md`). **Start only after phase 3 (Arabic/English) is merged**, so every new string is born bilingual.

## 1. Goals
- A team can run a **pediatric cardiac arrest** with ResusCode: weight-based doses and shock energies, the pediatric arrest algorithm, pediatric CPR and ventilation guidance, and a pediatric post-ROSC bundle.
- Adult mode keeps behaving and looking **exactly** as today, apart from a new Adult / Pediatric toggle on the idle screen.
- Pediatric codes are kept separate from adult codes in stats, history, the CSV and the admin sheet.
- This builds the base that the later sub-phases add to: 4b (bradycardia with pulse), 4c (tachycardia with pulse) and 4d (shock management).

## 2. Non-goals (4a)
- Bradycardia, tachycardia and shock workflows (4b–4d).
- Neonatal resuscitation (NRP) and newborn delivery-room algorithms.
- Broselow / length-based weight.
- ETT-route drug dosing.
- Weight-based infusion rates.

## 3. Decisions taken
| Topic | Decision |
|---|---|
| Scope | Full PALS is split into 4a–4d; this spec is 4a only. |
| Guideline | **SHA PALS provider manual.** Values below are AHA PALS 2020/2023 figures (the basis of SHA PALS). Every value needs clinician sign-off against the hospital's SHA PALS edition (§10). |
| Weight entry | Measured kg, **or** estimate from age (APLS formulas), clearly labelled "estimated". |
| Mode choice | Chosen on the idle screen before Start code. **Locked** once the code starts. A mis-pick is fixed by ending the code and starting a new one. |
| Architecture | **Protocol profiles:** one HUD reads an adult or pediatric profile module, with no duplicated screens. |
| Missing weight | **Never blocks CPR or logging.** Doses and energies read "Set weight" until a weight exists. |

## 4. Data model — session schema v4
- **New `PersistedSession` fields:**
  - `population: 'adult' | 'pediatric'`;
  - `weightSource: 'measured' | 'estimated' | null`;
  - `ageMonths: number | null`, set when the weight was estimated from age.
  - The existing `weightKg` is reused. The adult default stays 70 kg (used today for lidocaine). In pediatric mode `weightKg` is `null` until set, so the type widens to `number | null`, and adult code paths treat `null` as the default 70 kg.
- **Migration.** `sanitizeSession` accepts v2, v3 and v4. A v2/v3 session upgrades to `population: 'adult'`, `weightSource: null` and `ageMonths: null`, with all other values unchanged.
- **Validation.**
  - `population` must be `'adult'` or `'pediatric'`. An invalid value rejects the session, because doses depend on it.
  - `weightKg` must be `null` or a number in the range 0.5–150.
  - `ageMonths` must be `null` or an integer in the range 0–216.
- **Device preference** `resuscode.population` (`'adult' | 'pediatric'`) remembers the last choice for the idle toggle. It lives outside the session.
- **`startCode` behaviour.**
  - It copies the toggle and any weight already entered into the session.
  - The first event is a population event, e.g. `Pediatric code — 18 kg (estimated, age 4 y)` or `Pediatric code — weight not set`, with an i18n key and params as in phase 3.
  - After start, `population` cannot change. The store ignores attempts, and a test pins this.
- **New store action `setPediatricWeight(kg, source, ageMonths?)`.**
  - Allowed before and during a pediatric code.
  - Each change during a code logs an event: `Weight set — 18 kg (estimated, age 4 y)` / `Weight corrected — 20 kg (measured)`.
  - Doses already given keep the mg they were logged with. Only later doses use the new weight.

## 5. Profiles — `src/content/profiles/`
- **`adult.ts`** collects today's adult values (from `content/calc.ts`, `content/algorithm.ts` and `content/protocols.ts`) behind the profile interface. **No value changes**: adult golden tests (§9) prove it.
- **`pediatric.ts`** holds every pediatric value. It is the single file a clinician reviews.
- **`index.ts`** provides `profileFor(population)`.

**Profile interface (shape):**
- `epinephrine(weightKg|null, doseIndex)` → `{ mg, mL, perKgLabel, capped } | null`
- `shockEnergy(weightKg|null, shockIndex, escalate?)` → `{ joules, perKg, capped } | null`
- `amiodarone(weightKg|null, doseIndex)` → `{ mg, capped, exceedsTotal } | null`
- `lidocaine(weightKg|null, doseIndex)` → `{ mg, capped } | null`
- `magnesium(weightKg|null)` → `{ minMg, maxMg, capped } | null`
- `cpr` → `{ ratioKey, depthKey, rateKey }`; `ventilationWithAirwayKey`
- `algorithm(input)` → the same `AlgorithmView` shape as `nextAclsStep` (with phase 3 keys)
- `postRoscBundle` → checklist items (ids + keys)

`null` means "no weight, or an invalid weight": the UI shows "Set weight". Functions never return `NaN`.

## 6. Pediatric values (`pediatric.ts`; each one is a sign-off row in §10)
| Item | Rule | Ceiling |
|---|---|---|
| Epinephrine IV/IO | 0.01 mg/kg every 3–5 min; shown as mg and mL of 0.1 mg/mL | 1 mg per dose |
| Shock 1 | 2 J/kg | min(10 J/kg, adult max 200 J biphasic) |
| Shock 2 | 4 J/kg | same |
| Shock 3+ | 4 J/kg suggested; an "escalate" chip offers up to 10 J/kg | same |
| Amiodarone | 5 mg/kg per dose, up to 3 doses | 300 mg per dose; 15 mg/kg cumulative (flagged when exceeded) |
| Lidocaine | 1 mg/kg loading | 100 mg (flagged for review) |
| Magnesium (torsades) | 25–50 mg/kg | 2 g |
| CPR ratio | 30:2 with one rescuer, 15:2 with two | — |
| Depth / rate | about ⅓ of chest depth (≈4 cm infant, ≈5 cm child); 100–120/min | — |
| Ventilation with advanced airway | 1 breath every 2–3 s (20–30/min), continuous compressions | — |
| Epinephrine re-dose timer, 2-min cycle, metronome bpm | unchanged from adult | — |

**Rounding.**
- mg to 2 decimal places; mL to 1 decimal place; joules to a whole number.
- Energy shows the note "use the nearest available setting at or below".
- A value limited by a ceiling shows "(max)".

**Age estimate (APLS).**
- Under 12 months: 0.5 × months + 4.
- 1–5 years: 2 × years + 8.
- 6–12 years: 3 × years + 7.
- Over 12 years: kg entry only.
- Age chips: newborn (0 m), 3 m, 6 m, 9 m, 1 y–12 y.

**Algorithm.**
- **Shockable:**
  1. Shock 2 J/kg.
  2. CPR 2 min + IV/IO access.
  3. Shock 4 J/kg.
  4. CPR + epinephrine (every 3–5 min) + consider advanced airway.
  5. Shock ≥ 4 J/kg.
  6. CPR + amiodarone or lidocaine + treat H's & T's.

  Ongoing: shock at every 2-min check while VF/pVT persists.
- **Non-shockable:**
  1. CPR + epinephrine as soon as possible.
  2. IV/IO + advanced airway + capnography.
  3. Identify reversible causes.

  Ongoing: epinephrine every 3–5 min; recheck rhythm every 2 min.

**Shared with adult.** The 11 H's & T's and the POCUS list are reused unchanged.

**Pediatric post-ROSC bundle:**
- SpO₂ 94–99% and avoid hyperoxia;
- normal CO₂;
- avoid hypotension (SBP below the 5th centile for age), using fluids or vasoactives per local protocol;
- treat fever, temperature control;
- check glucose and correct it;
- 12-lead ECG / echo as indicated;
- seizure monitoring;
- transfer to PICU, then team debrief.

## 7. Screens
- **Idle HUD.**
  - An Adult / Pediatric segmented control sits above Start code.
  - Pediatric expands a **weight card** with two parts:
    - a kg stepper with quick chips (3, 5, 10, 15, 20, 30, 40 kg);
    - an "Estimate from age" row of age chips.
  - The result reads "18 kg (measured)" or "≈ 18 kg (estimated, 4 y)".
- **Pediatric code: header and weight.**
  - The header badge reads **PEDIATRIC · 18 kg (est.)**, in a new violet token, `--color-peds`, used only for this.
  - Tapping the badge opens the weight card for correction.
  - A red **"Set weight"** banner shows while no weight is set.
- **Pediatric code: intervention buttons.**
  - Epinephrine reads "Epinephrine 0.18 mg = 1.8 mL".
  - The shock button reads "36 J · 2 J/kg", with energy chips for 2 J/kg, 4 J/kg and "Escalate ≤ 10 J/kg", each showing its joules.
  - Amiodarone and lidocaine read in mg with the mg/kg.
  - **Without a weight:** the buttons read "Set weight" and open the weight card. Logging is still available as "Epinephrine given — dose not calculated (no weight)", recorded with no mg.
- **Pediatric code: other cards.**
  - The metronome card shows "15:2 (2 rescuers) / 30:2 (1 rescuer)".
  - The airway card shows "1 breath every 2–3 s".
  - The algorithm prompt uses the pediatric steps.
  - The H's & T's tab shows the pediatric post-ROSC bundle.
- **Adult mode.** Unchanged apart from the idle toggle.
- **Wording and layout.**
  - All new strings use phase 3 i18n keys (en + ar). Pediatric clinical Arabic carries `// draft — clinician review required`.
  - Doses, energies and weights are `dir="ltr"` isolates.
  - Everything fits at 360 px with no horizontal scroll.
- **Preview gate.** While `PEDIATRIC_CLINICAL_REVIEWED = false`, choosing Pediatric shows a persistent **"Preview — not for clinical use until clinician sign-off"** notice on the idle screen and on the header badge.

## 8. Stats, SBAR, history, CSV, upload, admin sheet
- **`CodeStats` (`STATS_VERSION` 2).**
  - New fields: `population`, `weightKg`, `weightSource`.
  - Each shock carries `joules` plus `perKg` (null for adult).
  - Doses logged without a weight count, and are marked "not calculated".
  - Records with `statsVersion` 1 read as adult.
- **SBAR (pediatric codes).**
  - Situation: "Pediatric in-hospital cardiac arrest — PALS (SHA)" plus the weight line (e.g. "Weight 18 kg (estimated from age 4 y)").
  - Background lists doses in mg with mg/kg.
  - Recommendations use the pediatric post-ROSC text.
  - Adult SBAR output is byte-identical to today, ignoring the "Generated:" line.
- **History panel.** A "Pediatric" tag on records. Totals and medians are shown separately for adult and pediatric codes, each with its own *n*.
- **CSV.** New columns: `population`, `weight_kg`, `weight_source`.
- **Upload.** `payloadVersion` stays 1, and the new stats fields are optional. A payload with no `population` is treated as adult.
- **Admin sheet (`sheetCore.js` + `main.gs.js` → `Code.gs`).**
  - New device-owned columns: `population`, `weight_kg`, `weight_source`, mapped by header name and appended to existing sheets.
  - The Dashboard gains a population selector cell (all / adult / pediatric), like the month filter.
  - `SETUP.md` gets an "Upgrading the script" section: paste the new `Code.gs`, then **update the existing deployment** (same URL).

## 9. Testing
- **Dose engine (`pediatric.test.ts`).**
  - A table test at 3, 10, 18, 25, 40, 60 and 100 kg covers every drug and energy, including where each ceiling applies: epinephrine capped at 1 mg from 100 kg; amiodarone at 300 mg from 60 kg; energy capped at 10 J/kg or 200 J.
  - Invalid weight (null, 0, negative, > 150, NaN) → `null`.
  - Every age chip gives the expected estimate.
- **Adult golden tests** pin today's output before the profile refactor: HUD dose labels, SBAR text and every store event label/detail. They must stay green afterwards.
- **Store tests.**
  - v3 → v4 migration gives an adult session.
  - Population is locked after start.
  - Start works without a weight.
  - A weight change mid-code logs an event, and only later doses change.
  - Logging epinephrine with no weight records no mg.
- **Stats/SBAR tests.**
  - Pediatric stats fields, and J/kg on shocks.
  - Pediatric SBAR lines in en and ar.
  - Split history aggregates.
  - CSV columns.
- **sheetCore tests.**
  - Payloads with and without the new fields.
  - Older rows stay untouched and read as adult.
  - Generated `Code.gs` in sync.
- **i18n.** en/ar parity for all new keys, and no hard-coded text (phase 3 guard test).
- **Browser at 360 px, en and ar:**
  - pediatric code via age estimate → epinephrine, shocks, amiodarone → correct the weight → doses change;
  - ROSC → pediatric bundle → SBAR;
  - adult flow unchanged.

## 10. Release gates
1. **Clinical sign-off.** A clinician checks every row of §6 against the hospital's SHA PALS edition (edition and year to be recorded), plus the Arabic pediatric wording. Until then `PEDIATRIC_CLINICAL_REVIEWED = false` keeps the preview notice on.
2. **Admin script upgrade.** The admin updates the existing deployment before devices running 4a upload pediatric codes. Old scripts ignore unknown columns, so nothing breaks in between, but the pediatric columns stay empty until the upgrade.
3. **Phase 3 merged first.**

## 11. Later sub-phases (outline only)
- **4b — Bradycardia with pulse:** a "with pulse" workflow that 4a's profile and weight engine extend (epinephrine 0.01 mg/kg, atropine 0.02 mg/kg, CPR if HR < 60 with poor perfusion).
- **4c — Tachycardia with pulse:** SVT/VT, adenosine 0.1 then 0.2 mg/kg, synchronized cardioversion 0.5–1 then 2 J/kg.
- **4d — Shock management:** fluid boluses 10–20 mL/kg with reassessment, vasoactive guidance.
