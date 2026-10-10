# CodeOR — Crisis & Resuscitation Engine

An ultra-responsive, mobile-first **Progressive Web App** for operating-room cardiac
arrests, perioperative crises, and ACLS event logging. Built to be used when alarms are
sounding, adrenaline is high, and providers are gloved.

**Live:** https://drabdo1990.github.io/ACLS-assist/

> **Clinical safety notice:** CodeOR is a decision-support and documentation aid. It is
> **not** a substitute for clinical judgement. Verify every dose against your local
> protocol before administration. It records **no patient identifiers (PHI-free)** and
> sends **no data** anywhere — everything stays on the device.

---

## Why it is built the way it is

- **No navigation latency.** Three workspaces in a single page with a three-target bottom
  tab bar. No router, no multi-level menus, no modal confirmation traps.
- **Gloved-hand ergonomics.** Primary controls are ≥ 64 px tall (up to 84 px for the
  highest-stakes actions), high contrast, with unmistakable pressed states.
- **Timestamps are the source of truth.** All clocks derive from absolute epoch timestamps,
  so a page refresh, a pause, or an OS-throttled background tab never causes drift.
- **Offline-first.** The whole app shell is precached by Workbox. Audio is synthesised with
  the Web Audio API (there are no media assets that could fail to load offline).
- **The screen never sleeps during a code.** `navigator.wakeLock` is held for the whole
  active/paused session and re-acquired after the tab is backgrounded.

---

## The three workspaces

### 1. Code HUD (CPR tracker)
- Giant monospace master arrest clock (`MM:SS`, promotes to `H:MM:SS`).
- Start / Pause / Resume, plus **press-and-hold** ROSC and Terminate (deliberate, not modal).
- **2-minute CPR cycle ring:** cyan → amber → flashing red in the last 10 s, with an audible
  alarm and a rhythm-check / switch-compressor prompt at 00:00. One-tap reset; the master
  clock keeps running.
- **CPR metronome** at 110 bpm with a lookahead audio scheduler, blinking visual beat and
  optional haptics.
- **One-tap ACLS interventions** (auto-timestamped): epinephrine with a configurable 3–5 min
  re-dose timer, defibrillation with 120/150/200 J selector and shock counter, amiodarone
  300→150 mg, advanced airway (switches the prompt to continuous compressions + 1 breath/6 s).
- **Reversible causes** — 4 H's and 4 T's quick toggles, each stamped into the log.
- **Post-arrest care bundle** appears on ROSC.

### 2. Crisis action cards
A shared **protocol weight** control (50/70/90/110 kg chips + 5 kg stepper) scales every dose:
- **LAST** — 20% lipid emulsion calculator (1.5 mL/kg bolus capped at 100 mL, 0.25 mL/kg/min
  infusion doubling to 0.5, live cumulative 12 mL/kg ceiling tracking) + the ASRA checklist.
- **Malignant Hyperthermia** — dantrolene 2.5 mg/kg with 20 mg vial count, reconstitution
  volume and admin volume; Ryanodex 250 mg single-vial path; hyperventilation, charcoal
  filters, cooling target 38.5 °C, and a one-tap MHAUS hotline dial.
- **CICO / failed airway (DAS 2025)** — one-tap declaration with elapsed clock, the
  scalpel–bougie–tube 6.0 sequence, and sugammadex 16 mg/kg mass + volume readout.
- **Maternal collapse** — the 4-minute rule with live countdown, left uterine displacement,
  and minute-4 / minute-5 milestone prompts.

### 3. Code log & SBAR export
- Chronological timeline with category filters and newest/oldest ordering.
- **Copy SBAR summary** — an EMR-ready plain-text debrief (Situation / Background /
  Assessment / Recommendations + full event timeline + drug and shock totals). Also
  downloadable as `.txt`.

---

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | React 19 |
| Build | Vite 8 + TypeScript 7 |
| Styling | Tailwind CSS v4 (`@theme` tokens, dark-only) |
| State | Zustand 5 (single event-driven store) |
| Icons | lucide-react |
| Offline | vite-plugin-pwa 2 (Workbox `generateSW`) |
| Tests | Vitest 5 (pure engine + calculators + SBAR) |

No router, no UI kit, no chart library, no external fonts (system monospace stack), no
analytics, no telemetry.

---

## Getting started

```bash
npm install
npm run dev        # dev server
npm run build      # production build + service worker
npm run preview    # serve the production build
npm run test       # unit tests
npm run typecheck  # tsc --noEmit
npm run icons      # regenerate PWA PNG icons from scripts/gen-icons.mjs
```

Install to a phone home screen from the browser's "Add to Home Screen" for the full
standalone, offline experience.

---

## Deployment

Published to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.
The workflow runs the typecheck and the unit tests first, then builds and deploys — a
failing test blocks the release.

GitHub Pages serves a **project site** from a subpath (`/<repo>/`), so the build sets
`VITE_BASE=/ACLS-assist/`. `vite.config.ts` reads that env var for both Vite's `base` and
the PWA manifest `start_url`/`scope`, keeping the asset paths and the service-worker scope
in sync with the deploy path. Local development is unaffected (defaults to `/`).

Because GitHub Pages is HTTPS, the secure-context APIs CodeOR relies on — the service
worker (offline caching) and the Screen Wake Lock (keeping the display awake during a
code) — work correctly.

To deploy your own fork, change `VITE_BASE` to your repo name (the workflow derives it
from `github.event.repository.name`, so it works automatically).

---

## Architecture

```
src/
  engine/     types, Zustand store, timing math, audio, wake lock, haptics,
              persistence, SBAR formatter   ← all pure/testable where it matters
  content/    clinical data: causes, protocols, dose calculators
  hooks/      useTicker (app-wide render tick), useMetronome, useWakeLock
  components/ ui/ hud/ crisis/ log/
  screens/    HudScreen · CrisisScreen · LogScreen
```

**State machine:** `idle → active ⇄ paused → rosc | terminated`, with `reArrest` returning
to `active`. The store auto-saves a PHI-free snapshot to `localStorage` (key
`codeor.session.v1`) on a debounced revision counter, and flushes on `pagehide`. A reload
rehydrates and continues from the saved timestamps.

**Timing law:** `masterElapsed = (pausedAt ?? now) − startedAt − pausedAccumMs`. The ticker
only repaints. See `src/engine/timing.test.ts` for the exhaustive behaviour contract.

---

## Clinical sources encoded

ASRA LAST checklist and 20% lipid emulsion therapy · MHAUS dantrolene dosing (legacy vials
and Ryanodex) · DAS 2025 airway-failure guidance · the 4-minute perimortem caesarean rule ·
AHA ACLS epinephrine 3–5 min dosing interval.

All figures live in `src/content/` and are unit-tested — review and adjust them to match your
institution's protocol.
