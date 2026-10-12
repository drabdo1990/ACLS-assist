# Clinical benchmark — SHA ACLS Provider Manual 2024

Every clinical value in ResusCode, mapped to the Saudi Heart Association (SHA) ACLS
Provider Manual 2024. Where the manual is silent, the AHA 2020/2023 / ERC 2021 value is
kept and marked as such. Code locations are given so each value can be audited.

## CPR & ventilation

| Value in app | SHA 2024 | Code |
|---|---|---|
| Compressions 100–120/min, depth 5–6 cm, full recoil | Ch. 2 | `engine/store.ts` (start event) |
| 30 : 2 without advanced airway | Ch. 2, Ch. 4 | `hud/InterventionGrid.tsx` banner |
| Advanced airway: continuous compressions + 1 breath every 6 s | Ch. 4 | `hud/InterventionGrid.tsx` banner |
| Switch compressors every 2 min (5 cycles) | Ch. 2, Ch. 8 | `hud/CyclePanel.tsx` |
| Metronome 110 bpm (adjustable 100–110) | Ch. 2 (100–120/min) | `hud/MetronomeCard.tsx` |
| Airway confirmation with waveform capnography | Ch. 4 | `content/causes.ts` (Hypoxia) |

## Electrical therapy

| Value in app | SHA 2024 | Code |
|---|---|---|
| Biphasic 120 / 150 / 200 J, monophasic 360 J | Ch. 5: "follow the defibrillator manufacturer for initial and subsequent doses" — energies are AHA defaults | `content/calc.ts` `SHOCK_ENERGIES` |

## Drugs (Table 7.1)

| Drug | SHA 2024 | App |
|---|---|---|
| Epinephrine | 1 mg IVP, flush 20 mL NS, every 3–5 min; elevate arm 10–20 s | 1 mg, re-dose timer 3/4/5 min, flush note in button and log |
| Amiodarone | 300 mg IVP 1st, 150 mg IVP 2nd (VF/pVT) | Auto-sequenced 300 → 150 mg |
| Lidocaine | 1–1.5 mg/kg 1st; 0.5–0.75 mg/kg every 5–10 min; max 3 mg/kg (replaces amiodarone) | Weight-based, cumulative 3 mg/kg warning |
| Magnesium sulfate | 1–2 g IV, Torsades de pointes | One-tap log |
| Sodium bicarbonate | IV, hydrogen ion / hyperkalaemia | Countermeasure text (≈1 mEq/kg, AHA) |

## Reversible causes (Table 3.4)

SHA lists **six H's** — Hypoxia, Hypovolaemia, Hypothermia, Hydrogen ion, Hyperkalaemia
and **Hypoglycaemia** — and the T's Thrombosis (pulmonary), Thrombosis (coronary),
Tamponade and Toxins. Tension pneumothorax is retained from AHA/ERC. Clues and
countermeasures in `content/causes.ts` follow the table's risk factors and management
columns (e.g. hyperkalaemia: calcium chloride, glucose + insulin, sodium bicarbonate,
nebulised albuterol, diuretics, dialysis; PE: empirical thrombolysis when suspected,
embolectomy, eCPR — Ch. 10 Special circumstances).

## Care following resuscitation (Ch. 11)

| Value in app | SHA 2024 |
|---|---|
| ETT if not yet placed; SpO₂ 92–98 % | Ch. 11 §1 |
| Hypotension: IV fluid up to 2 L, then dopamine 5–10 mcg/kg/min | Ch. 11 §2 (norepinephrine / epinephrine and MAP ≥ 65 retained from AHA) |
| Unresponsive: temperature control 32–37.5 °C for 12–24 h, seizure control | Ch. 11 §3 |
| Correct glucose > 10 mmol/L, prevent hypoglycaemia | Ch. 11 §4 |
| 12-lead ECG decides ICU vs CCU; transfer when stable | Ch. 11 §5 |
| Avoid hyperventilation, PaCO₂ 35–45 mmHg | AHA (not stated in SHA) |

## Not covered by the manual text

The cardiac-arrest algorithm (Algorithm 10.3) and post-resuscitation algorithm
(Algorithm 11.1) are figures, so the step sequence in `content/algorithm.ts` follows the
manual's narrative (Ch. 10 "Cardiac Arrest Management": immediate defibrillation for
VF/pVT with treatment based on the number of shocks; CPR plus medication for
asystole/PEA) and the AHA algorithm it is aligned with. POCUS findings follow AHA/ERC.
