# Formal UI & Hospital-Grade Appearance Elevation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate ResusCode's visual appearance from a basic flat dark-mode website into a formal, attractive, hospital-grade clinical instrument (cockpit-grade dark aesthetic inspired by Philips IntelliVue, Zoll, and Stryker LIFEPAK devices) while preserving zero-latency gloved-hand ergonomics.

**Architecture:** Refine design tokens in `src/index.css` (layered surfaces, ambient edge highlights, medical device glow effects); elevate shared UI containers (`Panel.tsx`, `BigButton.tsx`, `HoldButton.tsx`, `Chip.tsx`); polish the Cockpit Header and Docked Navigation in `src/App.tsx`; and upgrade the primary clinical telemetry displays (`MasterClock.tsx`, `CyclePanel.tsx`).

**Tech Stack:** React 19, Tailwind CSS v4 (`@theme`), Lucide React, Vitest 5, TypeScript 7.

**Spec / Design Reference:**
- ResusCode Ergonomic Laws: high-contrast dark mode, gloved-hand hit targets (≥64px / 84px), offline-first PWA.
- Design Direction: Clinical Precision Cockpit (subtle gradients, depth elevation, micro-borders, clean typography, medical status pills).

## Global Constraints

- **Zero clinical logic alteration:** Timers, drug calculations, shock energies, algorithms, and event logging must not be modified.
- **Strict gloved-hand hit targets:** Buttons must retain minimum `min-h-[64px]` (or `min-h-[84px]` for high-stakes controls).
- **No hardcoded text:** Any newly introduced text labels must use i18n keys present in both `src/i18n/en.ts` and `src/i18n/ar.ts` (`src/i18n/hardcodedTextGuard.test.ts` must pass).
- **No physical left/right Tailwind classes:** Always use logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`) per `src/i18n/rtlClasses.test.ts`.
- **Offline & network safety:** No external web fonts or CDN assets; system font stacks with tabular numerals (`tnum`) only.
- **Verification before each commit:** `npm run typecheck` and `npm test` must stay 100% green (501 tests passing).

## Review Focus

1. **RTL class check:** Ensure no physical `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*`, or `pr-*` classes are introduced.
2. **Text guard check:** Verify all UI labels are resolved through `t()` or `keyed()` to prevent untranslated strings.
3. **Button sizing check:** Ensure all interactive cards and action buttons maintain ≥64px height.
4. **Monospace digit alignment:** Ensure elapsed timers and countdown digits do not shift horizontal width during live ticking.
5. **Contrast ratio:** Ensure all text in primary and muted states remains easily readable under ambient operating room / emergency department lighting.

---

### Task 1: Core Design Tokens & Surface Depth in `src/index.css`

**Files:**
- Modify: `src/index.css`
- Test: `src/i18n/rtlClasses.test.ts`, `npm test`

**Interfaces:**
- Consumes: Tailwind v4 `@theme` block.
- Produces: Enhanced theme color tokens, surface gradient classes, subtle ambient highlights, and clinical luminescence utilities.

- [x] **Step 1: Inspect current tokens in `src/index.css` and check baseline test run**
Run: `npm test -- --run src/i18n/rtlClasses.test.ts`
Expected: PASS

- [x] **Step 2: Update `src/index.css` with refined clinical tokens and utilities**
Add refined medical device palette tokens and helper utilities:
```css
@theme {
  --color-bg: #050811;
  --color-panel: #0a1120;
  --color-panel2: #101a2e;
  --color-panel3: #16243f;
  --color-line: #1e2e4a;
  --color-line-bright: #2d4268;
  --color-ink: #f0f4fd;
  --color-mute: #8d9fb8;

  --color-crit: #ef4444;
  --color-critdeep: #7f1d1d;
  --color-warn: #f59e0b;
  --color-cyber: #06b6d4;
  --color-good: #10b981;
  --color-peds: #8b5cf6;
}
```
Add depth and glow utility classes:
```css
@layer utilities {
  .surface-card {
    background: linear-gradient(180deg, rgba(16, 26, 46, 0.75) 0%, rgba(10, 17, 32, 0.85) 100%);
    box-shadow: 0 1px 0 0 rgba(255, 255, 255, 0.05) inset, 0 4px 12px 0 rgba(0, 0, 0, 0.35);
  }
  .surface-elevated {
    background: linear-gradient(180deg, rgba(22, 36, 63, 0.8) 0%, rgba(14, 23, 42, 0.9) 100%);
    box-shadow: 0 1px 0 0 rgba(255, 255, 255, 0.08) inset, 0 6px 16px 0 rgba(0, 0, 0, 0.45);
  }
  .glow-cyan {
    filter: drop-shadow(0 0 10px rgba(6, 182, 212, 0.25));
  }
  .glow-red {
    filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.25));
  }
}
```

- [x] **Step 3: Run test suite and typecheck**
Run: `npm test; npm run typecheck`
Expected: PASS

- [x] **Step 4: Commit changes**
```bash
git add src/index.css
git commit -m "style(theme): enhance clinical design tokens, surface depth and ambient highlights"
```

---

### Task 2: Elevate Base UI Surfaces (`Panel.tsx` & `Chip.tsx`)

**Files:**
- Modify: `src/components/ui/Panel.tsx`
- Modify: `src/components/ui/Chip.tsx`
- Test: `src/i18n/headerChips.test.ts`, `src/i18n/rtlClasses.test.ts`

**Interfaces:**
- Consumes: `PanelProps`, `ChipProps`.
- Produces: Hospital-grade card containers with top-edge ambient highlight, formal tag styling, and backlit active chip states.

- [x] **Step 1: Write/verify tests for `Panel` and `Chip` rendering**
Run: `npm test -- --run src/i18n/headerChips.test.ts`
Expected: PASS

- [x] **Step 2: Update `Panel.tsx` with refined medical panel framing**
Update `Panel.tsx` to use the elevated layered container with crisp border accents and formal telemetry header:
```tsx
const ACCENT_BORDER: Record<NonNullable<PanelProps['accent']>, string> = {
  none: 'border-line/80 hover:border-line-bright/60',
  crit: 'border-crit/50 shadow-[0_0_15px_rgba(239,68,68,0.12)]',
  warn: 'border-warn/50 shadow-[0_0_15px_rgba(245,158,11,0.12)]',
  cyber: 'border-cyber/50 shadow-[0_0_15px_rgba(6,182,212,0.12)]',
  good: 'border-good/50 shadow-[0_0_15px_rgba(16,185,129,0.12)]',
};
```
Incorporate subtle inner highlight and refined header typography (`tracking-[0.18em] font-bold text-[11px]`).

- [x] **Step 3: Update `Chip.tsx` with precision medical toggle appearance**
Elevate unselected and selected chip states:
- Unselected: `bg-panel2/80 border-line/90 text-mute hover:border-line-bright hover:text-ink`
- Selected: `border-cyber bg-cyber/20 text-cyber shadow-[0_0_8px_rgba(6,182,212,0.25)_inset]`

- [x] **Step 4: Verify tests and run typecheck**
Run: `npm test; npm run typecheck`
Expected: PASS

- [x] **Step 5: Commit changes**
```bash
git add src/components/ui/Panel.tsx src/components/ui/Chip.tsx
git commit -m "style(ui): elevate Panel and Chip components with clinical precision styling"
```

---

### Task 3: Elevate High-Acuity Tactile Controls (`BigButton.tsx` & `HoldButton.tsx`)

**Files:**
- Modify: `src/components/ui/BigButton.tsx`
- Modify: `src/components/ui/HoldButton.tsx`
- Test: `src/components/ui/holdLogic.test.ts`, `src/i18n/rtlClasses.test.ts`

**Interfaces:**
- Consumes: `BigButtonProps`, `HoldButtonProps`.
- Produces: Glove-friendly tactile buttons with directional depth, crisp icon containers, and clean active press states.

- [x] **Step 1: Verify hold logic tests before modifying component**
Run: `npm test -- --run src/components/ui/holdLogic.test.ts`
Expected: PASS

- [x] **Step 2: Update `VARIANT_CLASS` in `BigButton.tsx`**
Refine button variants to feel like tactile medical instrument switches:
- `neutral`: `bg-gradient-to-b from-[#162238] to-[#0f1828] border-line text-ink hover:border-line-bright shadow-[0_2px_6px_rgba(0,0,0,0.3)]`
- `primary` / `cyber`: `bg-gradient-to-b from-cyber/25 to-cyber/10 border-cyber/70 text-cyber hover:bg-cyber/30 shadow-[0_0_12px_rgba(6,182,212,0.2)_inset]`
- `crit`: `bg-gradient-to-b from-[#f84f4f] to-[#dc2626] border-crit text-white shadow-[0_0_16px_rgba(239,68,68,0.35),0_1px_0_0_rgba(255,255,255,0.25)_inset]`
- `warn`: `bg-gradient-to-b from-warn/25 to-warn/10 border-warn/70 text-warn hover:bg-warn/30 shadow-[0_0_12px_rgba(245,158,11,0.2)_inset]`
- `good`: `bg-gradient-to-b from-good/25 to-good/10 border-good/70 text-good hover:bg-good/30 shadow-[0_0_12px_rgba(16,185,129,0.2)_inset]`
- `outline`: `bg-panel/40 border-line hover:border-line-bright text-ink hover:bg-white/5`

- [x] **Step 3: Update `HoldButton.tsx` with enhanced progress animation**
Enhance the SVG/progress fill with smooth visual feedback and clear tactile indicators during the hold duration.

- [x] **Step 4: Verify test suite and typecheck**
Run: `npm test; npm run typecheck`
Expected: PASS

- [x] **Step 5: Commit changes**
```bash
git add src/components/ui/BigButton.tsx src/components/ui/HoldButton.tsx
git commit -m "style(ui): elevate BigButton and HoldButton with tactile clinical gradients and bevels"
```

---

### Task 4: Hospital Cockpit Header & Docked Navigation in `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`
- Test: `src/i18n/hardcodedTextGuard.test.ts`, `src/i18n/rtlClasses.test.ts`

**Interfaces:**
- Consumes: Header status indicators, population state, bottom tab state.
- Produces: Professional cockpit header bar with micro-indicator LEDs and docked frosted-glass tab bar.

- [x] **Step 1: Check existing header chips and text tests**
Run: `npm test -- --run src/i18n/headerChips.test.ts src/i18n/hardcodedTextGuard.test.ts`
Expected: PASS

- [x] **Step 2: Update Header in `src/App.tsx`**
- Refine the header bar with frosted glass backdrop (`bg-[#050811]/90 backdrop-blur-xl border-b border-line/70`).
- Brand typography: crisp letterspacing on `ResusCode` with an animated subtle heartbeat pulse on the `HeartPulse` icon.
- Telemetry status pills:
  - Wake-lock pill: add an active micro-LED green dot when active (`h-1.5 w-1.5 rounded-full bg-good animate-pulse`).
  - Offline pill: crisp warning pill with amber micro-LED.
  - Settings trigger: modern circular icon button with subtle border highlight.

- [x] **Step 3: Update Bottom Navigation Bar in `src/App.tsx`**
- Docked frosted-glass container (`bg-[#070b16]/95 backdrop-blur-2xl border-t border-line/80 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]`).
- Active tab pill: crisp highlight indicator with glowing badge dots.

- [x] **Step 4: Run tests and typecheck**
Run: `npm test; npm run typecheck`
Expected: PASS

- [x] **Step 5: Commit changes**
```bash
git add src/App.tsx
git commit -m "style(app): elevate cockpit header and docked navigation with clinical telemetry styling"
```

---

### Task 5: Clinical Precision Chronograph (`MasterClock.tsx`) & 2-Min Cycle Display (`CyclePanel.tsx`)

**Files:**
- Modify: `src/components/hud/MasterClock.tsx`
- Modify: `src/components/hud/CyclePanel.tsx`
- Test: `src/engine/timing.test.ts`, `src/i18n/rtlClasses.test.ts`

**Interfaces:**
- Consumes: Master code timing state and 2-minute cycle timer.
- Produces: Formal digital monitor displays with deep contrast bezels, crisp tabular typography, and calibrated clinical status indicators.

- [x] **Step 1: Verify timing tests before modifications**
Run: `npm test -- --run src/engine/timing.test.ts`
Expected: PASS

- [x] **Step 2: Update `MasterClock.tsx`**
- Frame the master clock inside a dedicated instrument bezel container (`rounded-2xl border border-line/60 bg-gradient-to-b from-[#09101d] to-[#04070e] p-3 shadow-inner`).
- Digits readout: tabular monospace figures with subtle luminescent depth (`drop-shadow-[0_0_12px_rgba(240,244,253,0.15)]` when active).
- Status pill: formal badge with clinical micro-dot indicator (pulsing red during active arrest, emerald on ROSC, amber when paused).

- [x] **Step 3: Update `CyclePanel.tsx`**
- Upgrade circular CPR timer SVG:
  - Deep track ring: `#0d1524` with subtle outer bezel.
  - Active progress arc: crisp neon stroke with smooth transition.
  - Monospace countdown center: crisp digital numbers with high-contrast legibility.
- Expired rhythm check banner: clean high-impact emergency alert banner.

- [x] **Step 4: Verify test suite and typecheck**
Run: `npm test; npm run typecheck`
Expected: PASS

- [x] **Step 5: Commit changes**
```bash
git add src/components/hud/MasterClock.tsx src/components/hud/CyclePanel.tsx
git commit -m "style(hud): elevate MasterClock and CyclePanel with defibrillator-grade digital displays"
```

---

### Task 6: Full Integration Verification, Preview, and Documentation

**Files:**
- Test: Full Vitest test suite (`npm test`)
- Typecheck: TypeScript check (`npm run typecheck`)
- Build: Vite production build (`npm run build`)
- Docs: `docs/superpowers/plans/2026-10-18-formal-ui-elevation.md`

- [ ] **Step 1: Run full test suite and typechecker**
Run: `npm run typecheck; npm test`
Expected: 501 passed, 0 failures, 0 lint/type errors.

- [ ] **Step 2: Run production build**
Run: `npm run build`
Expected: Clean build with PWA service worker generated in `dist/`.

- [ ] **Step 3: Commit final plan update or sign-off**
```bash
git add docs/superpowers/plans/2026-10-18-formal-ui-elevation.md
git commit -m "docs(plan): complete formal UI elevation plan"
```

