# Arabic clinical wording — clinician review

**Status:** draft. `AR_CLINICAL_REVIEWED = false` in `src/i18n/review.ts`. While it is false, Arabic mode shows the notice "Arabic clinical text is a draft awaiting clinician review — English is the reference."

## What needs sign-off
All Arabic strings in `src/i18n/ar.ts` marked `// draft — clinician review required`, grouped by key prefix:

| Key prefix | What it is | Where it shows |
|---|---|---|
| `ev.*` | Event-log labels and details (CPR, cycles, shocks, drugs, ROSC, airway, causes, POCUS, pulse check, post-ROSC ticks) | Timeline, Arabic SBAR |
| `cause.*`, `causes.*` | The 11 H's & T's: name, bedside clue, countermeasure | H's & T's tab |
| `pocus.*` | POCUS findings: view, finding, meaning | H's & T's tab |
| `postRosc.*` | Post-ROSC bundle items | H's & T's tab, SBAR |
| `algo.*` | Algorithm prompt: titles, steps, ongoing guidance | HUD |
| `hud.*` | HUD buttons, dose hints, metronome, cycle panel | HUD |
| `sbar.*` | SBAR headings, situation line and recommendations | Arabic SBAR export |
| `stats.*`, `outcome.*`, `status.*`, `history.*` | Statistics rows, outcomes and history | Log screen, Arabic SBAR |
| `rhythm.*`, `branch.*`, `waveform.*`, `airway.*` | Rhythm, branch, waveform and airway names | HUD, Timeline |
| `settings.device.note`, `enroll.notice`, `enroll.nothingSent` | Enrollment privacy notice (consent wording; also needs data-governance review) | Settings, enrollment prompt |

Interface text that isn't clinical (buttons, filters, Settings labels) carries no marker and needs no clinical sign-off.

## Conventions the translation follows
- Drug names, doses and units stay Latin inside Arabic: `Epinephrine 1 mg IV/IO`, `mg/kg`, `J`, `SpO₂ 92–98%`.
- Times and numbers use Western digits. Durations in Arabic show as clock format (`6:45`), which avoids Arabic plural forms.
- Abbreviations stay Latin where clinicians use them as-is: CPR, ROSC, VF, pVT, PEA, ETT, SGA, POCUS, ICU/CCU, STEMI, PCI.
- The English text is the audit trail. Stored events keep their English labels, so changing an Arabic string never changes the record.

## How to review
1. In Settings → Language, choose **العربية**.
2. Run a training code covering start, pause/resume, rhythm checks on both branches, shocks, epinephrine, amiodarone/lidocaine, magnesium, airway, causes, POCUS, ROSC and the post-ROSC ticks. Then review the HUD, H's & T's, Log and SBAR preview.
3. Compare against `src/i18n/en.ts` (same keys), or ask a developer for a side-by-side export.
4. Record corrections against the key names.

## Sign-off
| Reviewer | Role | Date | Scope (key prefixes) | Notes |
|---|---|---|---|---|
| | | | | |

After sign-off, a developer applies the corrections in `ar.ts`, removes the markers from the reviewed lines, sets `AR_CLINICAL_REVIEWED = true` and records this table in the commit.
