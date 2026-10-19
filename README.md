# ResusCode — ACLS & PALS Code Blue Command Engine

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23410467.svg)](https://doi.org/10.5281/zenodo.23410467)

A mobile-first, high-reliability **Progressive Web App** that serves as the real-time
cognitive command HUD and timekeeper for adult and pediatric cardiac arrest — built for Code
Blue teams, Emergency Departments, ICUs, and rapid-response resuscitation leaders.

**Live:** https://code-blue-excel.drabdo2020.workers.dev/

> **Clinical safety notice:** ResusCode is a decision-support and documentation aid that
> follows AHA / ERC adult ACLS and the SHA PALS provider course. It is **not** a substitute
> for clinical judgement. Verify
> every dose against your local protocol. It records **no patient identifiers (PHI-free)** and
> has **no third-party analytics**. Data stays on the device unless your unit's admin enrols it
> for the optional statistics upload (off by default — see [Optional code upload](#optional-code-upload)).

---

## High-stress ergonomic laws

- **Zero navigation latency.** Three workspaces, one bottom tab bar, no router. Settings is a full-screen sheet; there are no other modals.
  Every intervention is **one tap**. Only lifecycle transitions that are unsafe to trigger
  by accident (ROSC, End code, New session) are press-and-hold.
- **Gloved-hand targets.** Action buttons are 64–84 px tall, high contrast, with an
  unmistakable pressed state.
- **Night-mode palette.** Background `#06080e`, Code Red `#ef4444`, Warning Amber `#f59e0b`,
  Pulse Cyan `#06b6d4`, ROSC Emerald `#10b981`. All timers use monospace tabular figures.
- **Audio without assets.** Metronome ticks, the 3-chime 10-second warning, and the
  cycle-expiry klaxon are synthesised with the Web Audio API.
- **The screen never sleeps during a code.** `navigator.wakeLock` is held from Start Code
  through post-ROSC care and re-acquired after the tab is backgrounded.

---

## The three workspaces

### 1. ACLS Command HUD
- **Master code header** — giant `MM:SS` total arrest timer, status pill
  (Active Arrest · ROSC Achieved · Terminated), Start / Pause / ROSC Achieved / End & Review.
- **2-minute CPR cycle engine** — countdown ring: cyan (120–30 s) → amber (30–10 s) →
  flashing crimson (< 10 s, with a 3-chime warning). At 00:00 a klaxon sounds and a giant
  pulsating **RHYTHM CHECK / SWITCH COMPRESSORS** alert appears with one-tap rhythm logging.
  **Reset 2-Min Cycle** never disturbs the total arrest time.
- **Rhythm branch selector** — Shockable (VF / pVT) vs Non-shockable (Asystole / PEA) with a
  live algorithm checklist that advances as shocks and drugs are logged, and highlights the
  button the algorithm expects next.
- **One-tap intervention grid** —
  - Defibrillation: 120 / 150 / 200 J biphasic or 360 J monophasic, running shock tally.
  - Epinephrine 1 mg: dose counter and live "Next Epi eligible in mm:ss" (3/4/5 min
    interval), with an audible + flashing alert when the next dose is eligible.
  - Antiarrhythmic: Amiodarone (300 → 150 mg) or weight-based Lidocaine
    (1–1.5 → 0.5–0.75 mg/kg q5–10 min), auto-sequenced, with a 3 mg/kg cumulative-cap warning.
  - Magnesium sulfate 1–2 g one-tap log for Torsades de pointes.
  - Advanced airway (ETT / SGA): the ventilation banner switches from 30 : 2 to
    "Continuous compressions + 1 breath every 6 seconds (10 breaths/min)".
  - CPR metronome: 110 bpm lookahead-scheduled tick, LED-style beacon, optional haptics.
  - Undo last log.

### 2. Reversible causes & targeted algorithms
- **6 H's & 5 T's audit grid** (SHA adds hypoglycaemia) with a bedside clue and immediate
  countermeasure for each.
- **POCUS checklist** — effusion / tamponade, RV strain, organised contractility vs true
  standstill, lung sliding.
- **Post-ROSC bundle** — opens automatically when ROSC is declared: ETT if not placed,
  SpO₂ 92–98 %, hypotension → IV fluid up to 2 L then dopamine 5–10 mcg/kg/min, 12-lead ECG →
  Cath Lab, temperature control 32–37.5 °C for 12–24 h if unresponsive, glucose > 10 mmol/L
  corrected.

### 3. Timestamped log & SBAR export
- Filterable timeline of every action with elapsed `[MM:SS]` and wall-clock time.
- **Copy SBAR Resuscitation Summary** — plain-text note ready to paste into the EHR/EMR
  (Situation / Background / Assessment / Recommendations + full timeline). Also downloadable
  as `.txt`.

---

## Optional code upload

ResusCode keeps a compact **History** of finished codes on the device (statistics only — no
event log, no patient identifiers) with aggregates and a CSV export.

A unit can additionally enrol a device to upload each finished code to **its own Google Sheet**
through an Apps Script web app that the unit's admin owns. This is **off by default**: nothing is
queued or sent until an admin issues an enrollment link/code and the user confirms it in
Settings. What is sent: the code's statistics (including the patient's weight, and age for
pediatric codes), its start date/time, the unit label, and an SBAR summary with relative times only. What is never sent: patient identifiers. Uploads never block or
slow a running code, and a device can stop uploading at any time. Setup for admins:
[admin/SETUP.md](admin/SETUP.md).

> Start date/time plus unit can identify a patient indirectly. Do not enrol a unit for real use
> before your hospital's data-governance team has approved what is sent, who can open the sheet,
> and retention.

## Language — English / العربية

The whole app, clinical text included, runs in **English or Arabic** with a right-to-left layout
in Arabic. The language is detected from the device (Arabic when the browser's first language is
Arabic) and can be changed any time in **Settings → Language**; switching never touches the
running code. Clocks, doses and units stay in Western digits and Latin script, dates are always
Gregorian, and drug names stay Latin inside Arabic text.

- The event log keeps a canonical English audit trail; Arabic is rendered from keys stored with
  each event, and older events without keys show their English text.
- The SBAR export has its own language choice (defaults to the app language, remembered). Uploads,
  the device history and the CSV always stay English.
- **Arabic clinical wording is a draft.** Every Arabic clinical string carries
  `// draft — clinician review required`, and Arabic mode shows a notice that English is the
  reference until a clinician signs off — see
  [docs/i18n/arabic-clinical-review.md](docs/i18n/arabic-clinical-review.md).

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | React 19 |
| Build | Vite 8 + TypeScript 7 |
| Styling | Tailwind CSS v4 (`@theme` tokens, dark-only) |
| State | Zustand 5 (single event-driven store) |
| Icons | lucide-react |
| Offline | vite-plugin-pwa 2 (Workbox `generateSW`) |
| Tests | Vitest 5 (store, timing, clock, algorithm, calculators, SBAR, migration) |

No router, no UI kit, no external fonts, no analytics, no telemetry.

---

## Getting started

```bash
npm install
npm run dev        # dev server
npm run build      # production build + service worker
npm run preview    # serve the production build
npm run test       # unit tests
npm run typecheck  # tsc --noEmit
npm run icons      # regenerate PWA PNG icons
```

Install to a phone home screen ("Add to Home Screen") for the full standalone, offline
experience.

---

## Deployment

Deployed as the Cloudflare Worker `code-blue-excel` (static assets) by its connected Workers
Build. `wrangler.jsonc` is the source of truth for the Worker name, compatibility date and SPA
asset fallback; `npm run build` produces `dist`.

`.github/workflows/ci.yml` runs the typecheck, unit tests and build on every push and pull
request. The Cloudflare build must use the same command:
`npm run typecheck && npm test && npm run build` — a failing check blocks the release. There is
no GitHub Pages deployment.

The app is served from the Worker root, so the default Vite `base` of `/` is correct. If the app
is ever hosted under a sub-path, set `VITE_BASE` for both Vite and the PWA.

---

## Architecture

```
src/
  engine/     types, Zustand store, clock (hybrid monotonic), timing math, audio,
              wake lock, haptics, persistence (+ v1 migration), SBAR formatter
  content/    clinical data: ACLS algorithm, causes, POCUS, post-ROSC bundle, doses
  hooks/      useTicker (app-wide render tick), useMetronome, useWakeLock
  components/ ui/ hud/ causes/ log/
  screens/    HudScreen · CausesScreen · LogScreen
```

**State machine:** `idle → active ⇄ paused → rosc | terminated`, with `reArrest` returning to
`active`. The store auto-saves a PHI-free snapshot to `localStorage`
(`resuscode.session.v2`) on every mutation (debounced) and flushes on `pagehide`, so a
refresh or screen rotation resumes the code from its saved timestamps. Sessions saved by the
previous CodeOR build (`codeor.session.v1`) are migrated automatically.

**Precision clock:** absolute epoch timestamps are the persisted source of truth (they survive
a refresh). Live time advances on a `performance.now()` monotonic delta from an epoch anchor,
so wall-clock adjustments can't make running timers jump; it re-anchors after a device
suspend. The render ticker only repaints — it never accumulates time, so throttled background
tabs cannot drift.

---

## Clinical sources encoded

- **Adult ACLS benchmark: Saudi Heart Association (SHA) ACLS Provider Manual 2024** — CPR
  (Ch. 2), H's & T's (Table 3.4), airway & ventilation (Ch. 4), electrical therapy (Ch. 5),
  resuscitation drugs (Table 7.1), cardiac arrest rhythms (Ch. 10) and care following
  resuscitation (Ch. 11). Aligned with AHA 2020/2023 and ERC 2021 adult ALS guidance.
- **Pediatric PALS benchmark: SHA Pediatric Advanced Life Support Provider Course (“SHA PALS provider course”)** —
  systematic assessment & age-based vital signs/hypotension/hypoglycaemia thresholds (Module 1, Table 1.1),
  airway, ventilation & DOPE troubleshooting (Module 2, Table 2.4), shock classification & fluid/vasoactive
  management (Module 3), pediatric cardiac arrest CPR parameters (Module 4, Ch. 4, Table 4.4.3),
  weight-based defibrillation (2 → 4 → 4–10 J/kg) and resuscitation drugs (Module 4, Table 4.2.2, Ch. 4–5),
  reversible H's & T's (Table 4.4.1 & Table 4.4.5), and post–cardiac arrest care (Module 4, Ch. 6, Tables 4.6.1 & 4.6.3).
  Full reference text: [docs/sha-pals-provider-course.md](docs/sha-pals-provider-course.md).

See [docs/clinical-benchmark.md](docs/clinical-benchmark.md) for the value-by-value mapping.

All figures live in `src/content/` and are unit-tested — review and adjust them to match
your institution's protocol.

## Arrest clock

Total arrest time runs from code activation to the end of the code. Time logged as **CPR paused counts** (the patient is still in arrest); only **ROSC periods** are excluded. The 2-minute CPR cycle timer still pauses with CPR. Statistics report "time logged as paused" separately, and all statistic times are from activation, as logged.

## License

Released under the [MIT License](LICENSE). Use is also subject to the [clinical disclaimer](DISCLAIMER.md).
