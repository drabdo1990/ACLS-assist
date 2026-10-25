# Clinician-led simulation: formative usability protocol

**Date:** 2026-10-25
**Status:** Ready for clinician and local governance review; no clinical sessions have been run.

## Purpose

Measure whether clinicians can use ResusCode to select and document the expected actions during simulated adult cardiac arrest. The primary measures are time to correct shock/epinephrine, wrong selections, and missed steps.

This is a formative usability study. It does not measure real treatment delivery reliability, clinical effectiveness, or patient outcomes.

## Required approvals and safeguards

Before enrolling participants:

- Name a clinician facilitator who owns the scenario script and scores expected actions against the approved local protocol. The app's prompt is not the correctness standard.
- Obtain the local education, human-subjects/ethics, privacy, and employee-research determinations required for clinician participants. Use consent or information sheets when required.
- Use simulation only. Never use the study workflow during a real resuscitation.
- Use a dedicated simulation device or browser profile with no patient history and optional upload disabled. Do not enroll the study device in unit upload.
- Record no patient identifiers or staff names. Use coded run IDs. Store any consent or participant-linkage records separately under the approved governance process.
- Keep app version, device model, orientation, language, and settings consistent within a run. Record them before starting.
- Stop for a real clinical emergency, participant distress, accidental entry of identifiable information, or a facilitator safety concern.

## Roles and setup

- **Facilitator:** reads only the scripted cues, does not coach unless a stop/rescue criterion is met, and declares the scenario endpoint.
- **Observer:** timestamps cues and observed team actions, and records every wrong selection, correction, omission, and request for help.
- **Participant:** an individual clinician or a designated code leader, using the app as intended by the local study plan.

Use one synchronized observer timer, starting at code activation. Optional video review requires explicit governance approval. Use a separate, unrecorded practice session to explain the device and controls; do not teach the study scenarios.

Select **Start simulation** on the idle HUD so the code begins already marked training, then confirm the persistent **SIMULATION — NOT A REAL PATIENT** banner before the first cue. If a run was not started this way, restart it or mark **Log/SBAR → Code statistics → Training / simulation** before any action. Keep upload disabled even when the run is marked training. At the end, export the SBAR and attach it to the coded run record.

## Measure definitions

| Measure | Definition | Source |
|---|---|---|
| Observed time to correct first shock | Seconds from the initial shockable-rhythm cue to the observed shock action | Observer |
| Logged time to correct first shock | Seconds from the same cue to the first correct shock entry | Observer cue time + app timeline |
| Observed time to correct first epinephrine | Seconds from the epinephrine opportunity to the observed medication action | Observer |
| Logged time to correct first epinephrine | Seconds from the same opportunity to the first correct epinephrine entry | Observer cue time + app timeline |
| Wrong selections | Intervention, rhythm, dose, or energy selections inconsistent with the current scenario and local protocol, including selections immediately undone | Observer, reconciled with app log |
| Missed clinical steps | Required actions not performed by the defined checkpoint or scenario endpoint | Observer |
| Documentation omissions | Performed actions absent from the app log at scenario end | Observer + SBAR |
| Checklist omissions | Required reversible-cause, POCUS, or post-ROSC items not addressed by scenario end | Observer + SBAR |
| Assistance | Number and reason for facilitator prompts or rescues | Observer |

For a shockable scenario, the first epinephrine opportunity begins when the second shock is completed. For a non-shockable scenario, it begins at the initial non-shockable-rhythm cue. Report observed action and app-log times separately: a tap timestamp is not proof of medication administration or defibrillation.

Opening a selector is not itself an error. An incorrect selection still counts when undone. An action performed but not logged is a documentation omission, not a missed clinical step. If the facilitator supplies an action after a rescue, score the original step as missed and record the rescue.

## Scenario A: persistent VF/pVT with ROSC

Run in real time. Use locally approved energies and doses; the facilitator completes the expected-action column before the study and does not improvise it during scoring.

| Approximate checkpoint | Scripted cue only | Expected action to score |
|---|---|---|
| 0:00 | "Adult cardiac arrest. CPR is in progress. The monitor shows VF." | Shockable branch; immediate defibrillation; CPR resumed |
| After first 2-minute cycle | "Rhythm check: VF persists." | Second shock; epinephrine after the second shock; CPR resumed |
| After next 2-minute cycle | "Rhythm check: VF persists." | Third shock; antiarrhythmic per local protocol; reversible-cause review |
| After next 2-minute cycle | "There is now a pulse and organized rhythm." | Declare ROSC; complete applicable post-ROSC care and documentation |

**Endpoint:** after the post-ROSC checkpoint or at 10 minutes, whichever comes first. Record all unfinished required steps at the endpoint.

## Scenario B: PEA with ROSC

| Approximate checkpoint | Scripted cue only | Expected action to score |
|---|---|---|
| 0:00 | "Adult cardiac arrest. CPR is in progress. The monitor shows PEA." | Non-shockable branch; immediate epinephrine; no shock; reversible-cause review |
| After first 2-minute cycle | "Rhythm check: PEA persists." | Continue CPR; no shock; address reversible causes |
| 4:00 | "Rhythm check: PEA persists." | Repeat epinephrine when due under the approved 3–5 minute interval; no shock |
| After next 2-minute cycle | "There is now a pulse and organized rhythm." | Declare ROSC; complete applicable post-ROSC care and documentation |

**Endpoint:** after the post-ROSC checkpoint or at 10 minutes, whichever comes first.

Counterbalance scenario order across participants when practical. Record order and prior app experience because learning can change later-run results. Do not present repeated-run differences as independent participants or as controlled evidence.

## Observer run sheet

Complete one sheet per run. Use `A` for Scenario A and `B` for Scenario B. Keep raw seconds as well as derived values.

| Field | Entry |
|---|---|
| Run ID / scenario / scenario order | |
| App version / device / language | |
| Participant role / prior app use (no name) | |
| Code activation time | |
| Initial rhythm cue time | |
| First correct observed shock time / app-log time | |
| Second-shock completion time (Scenario A) | |
| Epinephrine opportunity time | |
| First correct observed epinephrine time / app-log time | |
| Wrong selections: count, time, selection, expected action, undone? | |
| Missed clinical steps: step and checkpoint | |
| Documentation omissions | |
| Reversible-cause / POCUS / post-ROSC omissions | |
| Assistance or rescue: time and reason | |
| Facilitator deviations or app failures | |
| SBAR exported and reconciled? | |

Derived times are `correct action time − opportunity time`. A missing correct action gets no invented numeric time; record it as missed/censored at the endpoint and include the run in the missed-step count.

## Analysis and review

1. Reconcile the observer sheet with the SBAR after every run. Resolve discrepancies using the approved observation/video record, not by assuming the app is correct.
2. Publish de-identified run-level results: each time interval, wrong-selection count and type, missed-step count and type, omissions, and assists.
3. Summarize times with median and range. Report wrong selections per run and missed steps as a proportion of predefined opportunities, with denominators. Include scenario and order.
4. Separately review every shock on a non-shockable rhythm, incorrect dose/energy, missed epinephrine, and facilitator rescue with the clinical lead.
5. Treat findings as formative. Do not infer patient benefit or compare against a control that was not studied. Change the workflow only after clinicians review the observed failure mechanism and agree on a corrective change.

## Technical preflight completed

On 2026-10-25, the app passed 43 test files / 565 tests, TypeScript typechecking, and the production build. A browser check confirmed that **Start simulation** opens an active code with `training: true` and the persistent simulation banner. These checks establish a technical baseline only. Browser interaction timing, clinician performance, clinical safety, and patient outcomes still require the simulation and governance process above.
