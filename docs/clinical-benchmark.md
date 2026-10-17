# Clinical Benchmark — SHA ACLS Provider Manual 2024 & SHA PALS Provider Course

Every clinical value in ResusCode, mapped to its Saudi Heart Association (SHA) reference:
- **Adult mode (`adult`):** **SHA ACLS Provider Manual 2024** (aligned with AHA 2020/2023 & ERC 2021).
- **Pediatric mode (`pediatric`):** **SHA Pediatric Advanced Life Support Provider Course (“SHA PALS provider course”)** — see [docs/sha-pals-provider-course.md](sha-pals-provider-course.md) for the complete course reference.

Where the SHA text is silent, the AHA 2020/2023 / ERC 2021 / APLS figure is kept and marked as such. Code locations are given so each value can be audited.

---

# Part 1 — Adult ACLS (SHA ACLS Provider Manual 2024)

## CPR & ventilation

| Value in app | SHA ACLS 2024 | Code |
|---|---|---|
| Compressions 100–120/min, depth 5–6 cm, full recoil | Ch. 2 | `engine/store.ts` (start event) |
| 30 : 2 without advanced airway | Ch. 2, Ch. 4 | `hud/InterventionGrid.tsx` banner |
| Advanced airway: continuous compressions + 1 breath every 6 s | Ch. 4 | `hud/InterventionGrid.tsx` banner |
| Switch compressors every 2 min (5 cycles) | Ch. 2, Ch. 8 | `hud/CyclePanel.tsx` |
| Metronome 110 bpm (adjustable 100–120) | Ch. 2 (100–120/min) | `hud/MetronomeCard.tsx` |
| Airway confirmation with waveform capnography | Ch. 4 | `content/causes.ts` (Hypoxia) |

## Electrical therapy

| Value in app | SHA ACLS 2024 | Code |
|---|---|---|
| Biphasic 120 / 150 / 200 J, monophasic 360 J | Ch. 5: "follow the defibrillator manufacturer for initial and subsequent doses" — energies are AHA defaults | `content/calc.ts` `SHOCK_ENERGIES` |

## Drugs (Table 7.1)

| Drug | SHA ACLS 2024 | App |
|---|---|---|
| Epinephrine | 1 mg IVP, flush 20 mL NS, every 3–5 min; elevate arm 10–20 s | 1 mg, re-dose timer 3/4/5 min, flush note in button and log |
| Amiodarone | 300 mg IVP 1st, 150 mg IVP 2nd (VF/pVT) | Auto-sequenced 300 → 150 mg |
| Lidocaine | 1–1.5 mg/kg 1st; 0.5–0.75 mg/kg every 5–10 min; max 3 mg/kg (replaces amiodarone) | Weight-based, cumulative 3 mg/kg warning |
| Magnesium sulfate | 1–2 g IV, Torsades de pointes | One-tap log |
| Sodium bicarbonate | IV, hydrogen ion / hyperkalaemia | Countermeasure text (≈1 mEq/kg, AHA) |

## Reversible causes (Table 3.4)

SHA lists **six H's** — Hypoxia, Hypovolaemia, Hypothermia, Hydrogen ion, Hyperkalaemia and **Hypoglycaemia** — and the T's Thrombosis (pulmonary), Thrombosis (coronary), Tamponade and Toxins. Tension pneumothorax is retained from AHA/ERC. Clues and countermeasures in `content/causes.ts` follow the table's risk factors and management columns (e.g. hyperkalaemia: calcium chloride, glucose + insulin, sodium bicarbonate, nebulised albuterol, diuretics, dialysis; PE: empirical thrombolysis when suspected, embolectomy, eCPR — Ch. 10 Special circumstances).

## Care following resuscitation (Ch. 11)

| Value in app | SHA ACLS 2024 |
|---|---|
| ETT if not yet placed; SpO₂ 92–98 % | Ch. 11 §1 |
| Hypotension: IV fluid up to 2 L, then dopamine 5–10 mcg/kg/min | Ch. 11 §2 (norepinephrine / epinephrine and MAP ≥ 65 retained from AHA) |
| Unresponsive: temperature control 32–37.5 °C for 12–24 h, seizure control | Ch. 11 §3 |
| Correct glucose > 10 mmol/L, prevent hypoglycaemia | Ch. 11 §4 |
| 12-lead ECG decides ICU vs CCU; transfer when stable | Ch. 11 §5 |
| Avoid hyperventilation, PaCO₂ 35–45 mmHg | AHA (not stated in SHA) |

## Not covered by the adult manual text

The cardiac-arrest algorithm (Algorithm 10.3) and post-resuscitation algorithm (Algorithm 11.1) are figures, so the step sequence in `content/algorithm.ts` follows the manual's narrative (Ch. 10 "Cardiac Arrest Management": immediate defibrillation for VF/pVT with treatment based on the number of shocks; CPR plus medication for asystole/PEA) and the AHA algorithm it is aligned with. POCUS findings follow AHA/ERC.

---

# Part 2 — Pediatric PALS (SHA PALS Provider Course)

Benchmarked to the **SHA Pediatric Advanced Life Support Provider Course (“SHA PALS provider course”)** developed with the Clinical Skills and Simulation Center at King Saud University Medical City ([docs/sha-pals-provider-course.md](sha-pals-provider-course.md)).

## Pediatric CPR & ventilation

| Value in app | SHA PALS Provider Course | Code |
|---|---|---|
| Compression rate 100–120/min (infant, child, adolescent) | Module 4, Ch. 4, Table 4.4.3 (p. 95) | `content/profiles/pediatric.ts`, `i18n/en.ts` (`p.cpr.rate`) |
| Compression depth: ≈ ⅓ AP chest diameter (≈ 4 cm / 1½ in infant, ≈ 5 cm / 2 in child, ≥ 2 in adolescent) | Module 4, Ch. 4, Table 4.4.3 (p. 95) | `content/profiles/pediatric.ts`, `i18n/en.ts` (`p.cpr.depth`) |
| 15 : 2 (2 rescuers) / 30 : 2 (1 rescuer) without advanced airway | Module 4, Ch. 4 (p. 95) | `content/profiles/pediatric.ts`, `i18n/en.ts` (`p.cpr.ratio`) |
| Continuous compressions with advanced airway; 1 breath every 2–3 s (20–30/min) | Module 2 (p. 45: 1 breath every 2–3 s for BMV / AHA 2020–2023 PALS); note Module 4 Ch. 4 (p. 95) also cites the 2015 figure of 1 breath every 6–8 s (8–10/min) | `content/profiles/pediatric.ts`, `i18n/en.ts` (`p.cpr.airway`) |
| Switch compressors every 2 min; full chest recoil; target ETCO₂ 15–20 mmHg | Module 4, Ch. 4 (pp. 94–95) | `hud/CyclePanel.tsx` |
| Airway confirmation with bilateral breath sounds + capnography / colorimetric CO₂ (after 6 breaths) + CXR; DOPE troubleshooting | Module 2 (pp. 46–48, Table 2.4) & Module 4, Ch. 6 (pp. 102–103) | `content/causes.ts`, `content/profiles/pediatric.ts` |

## Pediatric electrical therapy

| Value in app | SHA PALS Provider Course | Code |
|---|---|---|
| 1st shock: 2 J/kg | Module 4, Ch. 4 (p. 96) | `content/profiles/pediatric.ts` (`shockEnergy`) |
| 2nd shock: 4 J/kg | Module 4, Ch. 4 (p. 96) | `content/profiles/pediatric.ts` (`shockEnergy`) |
| 3rd & subsequent shocks: 4 J/kg default, escalate chip ≤ 10 J/kg, capped at adult dose (200 J biphasic) | Module 4, Ch. 4 (p. 96): "Shocks that follow: 4–10 J/kg maximum, or adult dosage" | `content/profiles/pediatric.ts` (`shockEnergy`), `hud/shockChips.ts` |
| Pad size & placement: infant pads < 10 kg (< 1 y), adult pads > 10 kg (≥ 1 y); anteroposterior in infants/young children | Module 4, Ch. 7 (p. 107, Fig. 4.7.2) | Documented in [docs/sha-pals-provider-course.md](sha-pals-provider-course.md) |
| Synchronized cardioversion (unstable SVT / VT with pulse): 0.5–1 J/kg initial, 2 J/kg subsequent | Module 4, Ch. 7 (p. 108) | Documented for Phase 4c in [docs/sha-pals-provider-course.md](sha-pals-provider-course.md) |

## Pediatric resuscitation drugs & weight estimation

| Item | SHA PALS Provider Course | Code |
|---|---|---|
| Epinephrine IV/IO: 0.01 mg/kg (0.1 mL/kg of 1:10,000 / 0.1 mg/mL) every 3–5 min, max 1 mg | Module 4, Ch. 2, Table 4.2.2 (p. 75) & Ch. 5 (p. 99) | `content/profiles/pediatric.ts` (`epinephrine`) |
| IV/IO drug administration: rapid IV/IO push during compressions + 5–10 mL NS flush | Module 4, Ch. 4 (p. 96) | `i18n/en.ts` (`peds.grid.epi.flush`) |
| Amiodarone IV/IO: 5 mg/kg per dose (VF/pVT), capped at 300 mg/dose, cumulative > 15 mg/kg flagged | Module 4, Ch. 4 (p. 96) & Ch. 5 (p. 99) (ceilings per AHA/SHA PALS) | `content/profiles/pediatric.ts` (`amiodarone`) |
| Lidocaine IV/IO: 1 mg/kg loading dose (VF/pVT), capped at 100 mg | Module 4, Ch. 4 (p. 96) & Ch. 5 (p. 99) | `content/profiles/pediatric.ts` (`lidocaine`) |
| Magnesium sulfate IV/IO: 25–50 mg/kg (max 2 g) for Torsades de pointes | Module 4, Ch. 4 (p. 96): "magnesium sulfate (torsades de pointes only)" | `content/profiles/pediatric.ts` (`magnesium`) |
| Weight estimation when unknown | Module 4, Ch. 4 (pp. 90, 96) recommends measured weight or length-based tape; app provides measured kg + APLS age-based estimate (`0.5×m+4` < 1 y, `2×y+8` 1–5 y, `3×y+7` 6–12 y) labelled "estimated" | `content/profiles/pediatric.ts` (`estimateWeightFromAgeMonths`) |

## Pediatric cardiac arrest algorithm (Module 4, Ch. 5, pp. 99–101, Fig. 4.5.1)

| Branch | SHA PALS Provider Course (pp. 99–101) | Code |
|---|---|---|
| **Shockable (VF / pVT)** | 1. Shock 2 J/kg → 2. CPR 2 min + IV/IO access → 3. Shock 4 J/kg → 4. After 2 shocks: CPR 2 min + Epinephrine 0.01 mg/kg q3–5 min + consider advanced airway → 5. Shock ≥ 4 J/kg (4–10 J/kg) → 6. After 3 shocks: CPR 2 min + Amiodarone 5 mg/kg or Lidocaine 1 mg/kg + treat H's & T's | `content/profiles/pediatric.ts` (`SHOCKABLE`) |
| **Non-shockable (Asystole / PEA)** | 1. Continuous high-quality CPR + Epinephrine 0.01 mg/kg q3–5 min ASAP → 2. IV/IO + advanced airway + capnography → 3. Identify & treat reversible causes (H's & T's); recheck rhythm every 2 min | `content/profiles/pediatric.ts` (`NONSHOCKABLE`) |

## Pediatric reversible causes — H's and T's (Module 4, Table 4.4.1 pp. 88–89 & Table 4.4.5 p. 97)

SHA PALS lists:
- **H's:** Hypovolemia, Hypoxia (Hypoxemia), Hydrogen ion excess (acidosis — consider bicarbonate for resuscitations > 30 min), Hyperkalemia (> 5.5 mEq/L), Hypokalemia (< 3.5 mEq/L), Hypothermia (< 35 °C), Hyperglycemia, and **Hypoglycemia** (Table 1.1 p. 12 thresholds: **< 45 mg/dL in neonates**, **< 60 mg/dL in infants, children, and adolescents**).
- **T's:** Tamponade (cardiac), Tension pneumothorax, Thrombosis (pulmonary), Thrombosis (coronary), Toxin.

## Pediatric post–cardiac arrest care (Module 4, Ch. 6, pp. 102–105, Tables 4.6.1 & 4.6.3)

| Bundle item in app (`PEDIATRIC_POST_ROSC_BUNDLE`) | SHA PALS Provider Course |
|---|---|
| `spo2`: SpO₂ 94–99% — avoid hyperoxia | Module 4, Ch. 6 "Breathing" & Table 4.6.1 (pp. 103–104): "O₂ saturation can be monitored via pulse oximetry (aiming for values between 94–99%)" / "avoiding hyperoxia" |
| `co2`: Normal CO₂ — check capnography / blood gas | Module 4, Ch. 6 "Breathing" & Table 4.6.1 (pp. 103–104): avoid hypocarbia/hyperventilation (except short-term for impending cerebral herniation) |
| `bp`: Avoid hypotension (SBP < 5th centile for age) — fluids or vasoactives per local protocol | Module 1 Table 1.1 (p. 12), Module 3 (pp. 53, 58–64) & Module 4 Ch. 6 (pp. 103–104): SBP thresholds `< 60` neonate, `< 70` infant, `< 70 + 2×age(y)` 1–10 y, `< 90` ≥ 10 y; isotonic crystalloid 20 mL/kg (5–10 mL/kg in cardiogenic dysfunction) + vasoactives/inotropes to maintain MAP & CPP |
| `temp`: Treat fever; temperature control per local protocol | Module 4, Ch. 6 Table 4.6.1 & "Exposure" (p. 104): "prevent and treat fever in all patients; targeting a hypothermia temperature range may be considered" |
| `glucose`: Check glucose and correct it | Module 1 Table 1.1 (p. 12) & Module 4 Ch. 6 "Disability" / Table 4.6.1 (pp. 103–104): treat hypoglycemia (< 45 mg/dL neonate, < 60 mg/dL child) and avoid hyperglycemia |
| `ecg`: 12-lead ECG / echo as indicated | Module 4, Ch. 6 Table 4.6.3 (p. 105) & Module 1 Table 1.3 (p. 19) |
| `seizure`: Monitor and treat seizures | Module 4, Ch. 6 "Disability" & Tables 4.6.1 / 4.6.3 (pp. 104–105): EEG monitoring and anticonvulsants |
| `picu`: Transfer to PICU; complete the record; team debrief | Module 1 "Practicing and Debriefing" (pp. 20–21) & Module 4 Ch. 6 (pp. 102–105) |
