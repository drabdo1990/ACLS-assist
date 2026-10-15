# ResusCode — Code Statistics, Admin Review and Arabic/English: Design Spec

- **Date:** 2026-10-16
- **Status:** awaiting review
- **Scope:** three phases, delivered in order. Each phase gets its own implementation plan after this spec is approved.

## 1. Goals

1. **Statistics at the end of a code**, so each code's data can be traced and compared over time.
2. **A central admin view**: all codes from all devices land in one Google Sheet owned by the admin, who writes the debriefing there.
3. **Arabic and English** for the whole app, including clinical text, with right-to-left layout.

## 2. Non-goals

- No in-app admin screen and no user accounts in the app. The admin works in Google Sheets.
- No patient or staff identifiers anywhere.
- No change to clinical algorithms, doses or protocol content (beyond translation in phase 3).
- No measurement of true hands-off time or CPR fraction. The app cannot observe compressions.
- No chart or i18n libraries. Small in-house modules and inline SVG only.

## 3. Decisions taken

| Topic | Decision |
|---|---|
| Statistics scope | Per-code summary **and** device history |
| Admin storage | Google Sheet + Google Apps Script web app owned by the admin's Google account |
| Access | One admin; codes are anonymous; each carries the unit name |
| Debriefing | The admin writes notes and categories in admin-owned sheet columns |
| Arabic scope | Whole app including clinical text; RTL |
| SBAR language | Follows the app language; English always selectable at export |
| Arrest clock | CPR-paused time **counts** as arrest time; only ROSC periods are excluded. One rule everywhere |
| Backfill | When a device is enrolled later, offer a one-time stats-only upload of earlier codes |
| Defaults | Language auto-detected (`ar*` → Arabic), toggle remembered; Western digits; Gregorian calendar; drug names, doses and units stay in Latin script |
| Delivery order | Phase 1 clock + stats → Phase 2 history + upload → Phase 3 Arabic/English |

---

## 4. Phase 1 — Clock model, statistics, per-code summary

### 4.1 Clock model (prerequisite)

**Current behaviour (verified):** `masterElapsedMs` subtracts `pausedAccumMs`. That field accumulates both CPR-pause time (`resumeCode`) and ROSC time (`reArrest`). Event `t` inherits this. A code terminated during a CPR pause freezes at the pause start (`terminateCode` keeps the existing `pausedAt`).

**New rule:** `arrestMs = (endedAt ?? now) − startedAt − roscAccumMs`. This applies to the master clock, every new event's `t`, the timeline, the SBAR, statistics and uploads.

Session schema **v3** (`PersistedSession.version: 3`):

| Field | Meaning in v3 |
|---|---|
| `endedAt: number \| null` | **New.** Set to the action time by `declareRosc` and `terminateCode`; cleared by `reArrest`. Freezes the master clock. |
| `roscAccumMs: number` | **New.** Sum of closed ROSC intervals. `reArrest` adds `at − endedAt`. |
| `pausedAt` | Unchanged role for the **2-minute cycle timer** (CPR pause, ROSC and termination still freeze the cycle). No longer read by the master clock. |
| `pausedAccumMs` | **Narrowed:** total CPR-pause time only. `reArrest` no longer adds to it. Drives the "time logged as paused" statistic. |
| `cyclePausedAccumMs`, `cycleStartedAt` | Unchanged. |

`masterElapsedMs` takes `{ startedAt, endedAt, roscAccumMs }`. All callers are updated: `store.ts`, `MasterClock.tsx` and `sbar.ts`.

**Migration v2 → v3** (in `sanitizeSession`; the existing logged `t` values are never rewritten):
- Find the ROSC intervals: each `rosc` event ("ROSC declared") is paired with the next `system` "Re-arrest" event. `roscAccumMs` is the sum of the closed pairs.
- `endedAt`:
  - status `rosc` → `at` of the last ROSC event;
  - status `terminated` → `at` of the "Code ended" event (fall back to `pausedAt`);
  - otherwise `null`.
- `pausedAccumMs_v3 = max(0, pausedAccumMs_v2 − roscAccumMs)`.
- v1 → v2 → v3 chains through the existing `migrateV1`.

**Acceptance criteria:**
- With CPR paused for 60 s, the master clock keeps running. The cycle timer stops. The next event's `t` includes the 60 s.
- ROSC freezes the master clock. Re-arrest resumes it, and the ROSC interval is excluded.
- Terminating while CPR is paused freezes the clock at the termination time.
- A v2 session restored mid-code shows its previous arrest time **plus** any CPR-pause time it had (which now counts); ROSC periods remain excluded.
- Existing tests that assert pause-excluded `t` are updated deliberately; nothing else changes.

### 4.2 Statistics engine — `src/engine/stats.ts` (pure)

```ts
type Outcome = 'rosc' | 'rosc_rearrest' | 'terminated' | 'incomplete';

interface CodeStats {
  statsVersion: 1;
  startedAt: number;              // epoch ms
  endedAt: number | null;
  arrestMs: number;               // per 4.1
  outcome: Outcome;
  roscCount: number;
  firstRoscMs: number | null;     // from activation
  firstShockMs: number | null;    // from activation
  firstEpiMs: number | null;      // from activation
  branchAtFirstEpi: RhythmBranch | null;
  shocks: { count: number; joules: number[] };
  epi: { count: number; meanIntervalMs: number | null; longestIntervalMs: number | null;
         configuredIntervalMs: number; longestExceedsConfigured: boolean };
  amiodarone: { count: number; totalMg: number };
  lidocaine: { count: number };
  magnesium: { count: number };
  cycles: number;                 // count of 'cycle' events
  pausedMs: number;               // pausedAccumMs + (status === 'paused' ? now − pausedAt : 0)
  airway: { type: AirwayType | null; firstPlacedMs: number | null };
  rhythms: string[];              // from "Rhythm check — X"
  causes: CauseId[];
  pocus: PocusId[];
  postRosc: { done: number; total: number } | null;   // null if no ROSC
}

function computeCodeStats(session: PersistedSession, now: number): CodeStats | null; // null if never started
```

**Rules:**
- "From activation" means `event.at − startedAt` in wall-clock time, labelled **"from activation, as logged"** wherever it is shown.
- Outcome:
  - `rosc` — final status is `rosc`.
  - `rosc_rearrest` — status `terminated` with `roscCount > 0`.
  - `terminated` — status `terminated` with no ROSC.
  - `incomplete` — status `active` or `paused` when the record is captured.
- Missing or legacy data gives `null` or an empty value, shown as "—". It never throws and never shows a fake 0.

**Acceptance criteria:** unit tests cover each outcome, codes with no shock or no epi, the epi-interval threshold against the configured interval, an open pause, re-arrest, and a v1-migrated session.

### 4.3 Per-code summary

- A **"Code statistics" panel** on the Log/SBAR screen, shown when a code has started. It has:
  - a **Training / simulation** toggle;
  - a **Void** action, hold to confirm.
- Both flags live in the session (`training: boolean`, `void: boolean`, default `false`).
- Void keeps the record but excludes it from statistics. Nothing is deleted.
- An `=== CODE STATISTICS ===` section goes in the SBAR, placed after ASSESSMENT.

**Acceptance criteria:** the panel and SBAR show identical values. Training and void are persisted and restored.

---

## 5. Phase 2 — Device history, Settings, Google Sheets upload

### 5.1 Device history — `src/engine/history.ts`

```ts
interface CodeRecord {
  id: string;            // `${startedAt}-${deviceId}`
  deviceId: string;      // random, generated once per device and stored as a preference
  startedAt: number;
  unit: string | null;   // filled from enrollment when known
  stats: CodeStats;
  training: boolean;
  void: boolean;
  uploadStatus: 'local' | 'queued' | 'sent' | 'sent_unconfirmed' | 'failed' | 'rejected';
  savedAt: number;
}
```

**Storage:**
- Key `resuscode.history.v1`.
- Capped at **500 records**, oldest dropped. The array is compact and holds no event log; a test enforces a size budget under 1 MB.
- Validated on load using the sanitiser pattern from `persistence.ts`.

**Recording rule:** a code is recorded if either is true:
- arrest duration is at least 60 s;
- it has any shock, drug, airway, rhythm or ROSC event.

"End code" alone does not count.

**Capture:**
- A store subscriber with `(state, prevState)`.
- Upsert by `id` when any of these happens:
  - status becomes `rosc` or `terminated`;
  - a reset (`prevState.startedAt != null && state.startedAt == null`), with the record built from `prevState`;
  - any mutation while status is `rosc` or `terminated`, debounced 1 s.

**Safety:**
- The subscriber body is wrapped in `try/catch`, and errors are logged. `reset()` must never throw because of history.
- Writes are immediate (not debounced 400 ms). Each write is read-modify-write at write time.
- `navigator.locks` (when available) guards outbox flushes.
- `navigator.storage.persist()` is requested once.
- Write failures surface through the existing NOT SAVED chip.

**History section** (inside the Log/SBAR screen; the bottom bar stays at three tabs):
- **Aggregates:**
  - count, ROSC rate, medians of `firstEpiMs`, `firstShockMs` and `arrestMs`;
  - *n* is always shown, and counts replace rates when n < 5;
  - training, void and incomplete records are excluded, with incomplete counted separately.
- **Record list:** past codes, newest first. Tapping one opens its summary, where training and void can be edited (and re-uploaded).
- **CSV export:**
  - UTF-8 BOM, RFC 4180 quoting;
  - cells starting with `= + - @` are prefixed with `'`.
- **Clear history:** hold to confirm.
- **Retention setting:** keep all / keep last N / delete after confirmed upload.

**Settings sheet** (gear icon in the header): language (phase 3), unit enrollment, upload status and retention.

### 5.2 Google Sheets channel

**Ownership:** the admin's Google account owns the Sheet and an Apps Script web app, deployed with "Execute as: me" and "Who has access: anyone". The app has no Google login.

**Sheet tabs:**
- `Codes`, with two groups of columns:
  - *Device-owned* (written by the script): `record_id`, `unit`, `device_id`, `start_iso`, `start_epoch_ms`, `outcome`, `training`, `void`, one column per `CodeStats` field (flattened), `sbar`, `payload_version`, `stats_version`, `last_upload_iso`.
  - *Admin-owned* (never written by the script): `debrief_note`, `issue_category` (dropdown: CPR quality, drug timing, airway, defibrillation, communication, equipment, other), `action_status` (dropdown: none, open, done), `reviewed` (checkbox), `reviewer`, `review_date`, `exclude` (checkbox), `duplicate_of`.
- `Dashboard`: formulas by unit and month, excluding training, void and `exclude` rows. It shows count, ROSC rate, median time to first epi and first shock, and issue counts per category.
- `Units`: `enrollment_key`, `unit_name`, `active`. The admin adds one row per unit; setting `active = FALSE` revokes that unit.

**Upload payload** (`payloadVersion: 1`, sent as the request body with `Content-Type: text/plain` to avoid a CORS preflight):

```ts
interface UploadPayload {
  payloadVersion: 1;
  enrollmentKey: string;
  recordId: string;
  deviceId: string;
  startEpochMs: number;
  startIso: string;          // with UTC offset
  training: boolean;
  void: boolean;
  stats: CodeStats;
  sbar?: string;             // English SBAR with relative [MM:SS] times only; omitted for backfill
}
```

**Script behaviour.** The pure logic lives in `src/admin/sheetCore.ts` and is tested with Vitest. A build script (`npm run build:apps-script`) emits ES-module-free `admin/apps-script/Code.gs` with a thin `doPost`.
1. Reject requests over 100 KB, unknown `payloadVersion`, schema errors, a bad `recordId` format, and unknown or inactive keys. The response is `{ok:false, error:'size'|'version'|'schema'|'key'}`.
2. Hold `LockService.getScriptLock()` around find-or-insert by `record_id`.
3. Map columns **by header name**; append missing device-owned headers; never reorder.
4. Write **only the device-owned fields present in the payload**. Absent fields keep their current cell values. Admin-owned columns are never written.
5. Neutralise formula injection: any string starting with `= + - @` is written with a leading `'`.
6. Truncate strings to 50,000 characters, the Sheets cell limit.
7. Respond `{ok:true}`. The script never returns sheet data.

**Device behaviour:**
- **Enrollment:** done once per device in either of two ways.
  - The admin shares a link or QR code: `<app-url>#enroll=<base64url({url,key})>`. The app reads it, stores it, and removes the fragment with `history.replaceState`.
  - Settings accepts the same string pasted as a one-line enrollment code. This route is required on iOS, where Safari and the home-screen app have separate storage.
- The stored URL and key are device preferences and never appear in the repository.
- **The outbox exists only while enrolled:**
  - It holds the latest payload per `recordId`, coalesced.
  - The SBAR is built at upsert and dropped after delivery.
  - Flushes run on app start, on the `online` event, and after an upsert.
  - Network failures and 5xx responses get exponential backoff (1 s → 5 min cap).
  - `error: key|schema|version` marks the record `rejected` and stops retrying, and the UI shows "Enrollment invalid — contact admin" or "Update app".
- **Backfill:** right after enrollment, one prompt: "Send N earlier codes (statistics only)?" Backfilled payloads have no `sbar`.
- **Upload is OFF until enrolled.** Enrolling shows a notice saying what is sent. All wording that says "PHI-free / no data leaves this device" is updated to describe the enrolled case: the `App.tsx` footer, the comments in `persistence.ts`, the manifest description and the README.

**Feasibility spike (first task of phase 2; the outcome is not assumed).** A ~15-line `doPost` echo script is deployed from the admin account. From the GitHub Pages origin and from `localhost`, it `fetch`es POST `text/plain` and records whether the response body is readable.
- **Readable:** statuses `sent` / `rejected` as above.
- **Not readable:** use `mode: 'no-cors'`. Status becomes `sent_unconfirmed`, and every payload is resent once more on the next app start (idempotent). The Dashboard gains a "last upload per unit" view so silent units are visible.

**Admin deliverables:** `admin/apps-script/Code.gs`, `admin/SETUP.md`, and a sheet template.
- `SETUP.md` covers creating the sheet, pasting the script, deploying, adding unit keys and generating the link or QR.
- It warns to **update the existing deployment** rather than creating a new one, because a new deployment changes the URL.
- The template includes the dropdowns, checkboxes and Dashboard formulas.

**Acceptance criteria:**
- A code ended offline is uploaded later when the device is online.
- Re-uploading after toggling training changes only the `training` cell, and the SBAR cell keeps its value.
- Admin columns survive every re-upload.
- Two tabs open on one device produce one row.
- A revoked unit sees "Enrollment invalid" (if responses are readable).
- The CSV opens correctly in Excel, including Arabic text.

---

## 6. Phase 3 — Arabic / English

- **Structured events:**
  - `CodeEvent` gains optional `key?: string` and `params?: Record<string, string | number>`.
  - All 26 `mkEvent`/`logEvent` call sites set them.
  - `label` and `detail` stay canonical English, and all logic keeps matching on them.
  - `sanitizeSession` validates the new fields.
- **i18n module (`src/i18n/`):**
  - `en.ts` defines `type MessageKey` and the English messages; `ar.ts` must satisfy `Record<MessageKey, string>`.
  - `t(key, params)` interpolates `{name}`. Count-dependent phrases are worded to avoid Arabic plural forms.
  - The language is stored in `resuscode.lang`, separate from the session.
  - `useT()` uses `useSyncExternalStore`. A language change sets `document.documentElement.lang` and `dir`.
- **Dates:** `Intl.DateTimeFormat(lang, { calendar: 'gregory', numberingSystem: 'latn', ... })`.
- **Content:**
  - `causes`, `pocus`, `protocols`, `algorithm` and the user-facing labels in `calc` are referenced by key.
  - Pure functions keep returning numbers and keys, so the existing tests stay valid.
- **RTL:**
  - Logical Tailwind utilities (`ms/me/ps/pe/start/end`) replace the physical ones in `App.tsx`, `Timeline.tsx`, `HoldButton.tsx`, `Panel.tsx` and `WeightControl.tsx`.
  - Clocks, doses and numbers are wrapped as `dir="ltr"` isolates.
  - Directional icons are mirrored.
  - A system Arabic font stack is added, with no web fonts.
  - Large HUD text and 64 px buttons get a legibility check.
- **SBAR:**
  - `buildSbar(input, now, lang)`.
  - An export-language selector defaults to the app language and remembers the last choice.
  - Upload payloads always use English.
- **Clinical wording:** every Arabic clinical string carries a `// draft — clinician review required` marker. Release requires sign-off.

**Acceptance criteria:**
- Every `en` key exists in `ar` with the same `{params}` (test).
- Switching language mid-code re-renders the whole log without data changes.
- Clocks stay LTR in RTL layout.
- No horizontal scroll at 360 px width.
- Legacy events without `key` render their English label.

---

## 7. Testing summary

- **Phase 1:** clock (pause counts; ROSC excluded; re-arrest; terminate while paused; v2→v3 migration), stats (all outcomes and edge cases), summary/SBAR parity, training and void persistence.
- **Phase 2:**
  - history: recording rule; upsert idempotency; reset capture from `prevState`; a subscriber failure leaves `reset()` working; cap and size budget; sanitiser; CSV BOM, quoting and injection;
  - sheet core: find-or-insert; admin columns untouched; absent fields untouched; header mapping; injection; truncation; version and key rejection;
  - outbox: exists only when enrolled; coalescing; backoff; rejection stops retries; backfill.
- **Phase 3:** key completeness and params, date formatting, SBAR in both languages, legacy fallback.
- **Every phase:**
  - `npm run typecheck`, `npm test` and `npm run build` are green;
  - the existing 96 tests pass, apart from deliberate clock-assertion updates in phase 1;
  - a browser check of the phase's flows at phone width.

## 8. Risks and release gates

- **Upload (phase 2):**
  - Hospital data-governance approval is required before clinical use. It must cover what is sent, who can see the sheet, and retention on the device and in the sheet.
  - Start date/time plus unit is quasi-identifying even without names.
- **Apps Script:** quotas and response readability are settled by the spike.
- **Sheet access control** is the admin's Google sharing setting; the app cannot enforce it.
- **Arabic clinical wording (phase 3)** needs clinician sign-off.
- **Changing the on-screen arrest clock (phase 1)** changes what clinicians see. It is announced in the release notes and shown on first launch after the update.
