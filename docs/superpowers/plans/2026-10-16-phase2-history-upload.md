# Phase 2 — Device History, Settings, Google Sheets Upload: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a compact history of finished codes on the device, show aggregates and a CSV export, and (only when a device is enrolled by an admin) upload each finished code to a Google Sheet through an Apps Script web app. Upload is optional, off by default, and fails safe: it never blocks, slows or breaks a running code.

**Architecture:**
- **Injected storage.** Engine modules take a `KV` (string key/value) so they run in Node tests with an in-memory fake. Only the thin `service.ts` and the UI touch `localStorage`.
- **History.** `history.ts` (pure CRUD + aggregates, key `resuscode.history.v1`) fed by `historyCapture.ts`, a store `subscribe((state, prev))` observer. Capture on reset reads `prev`, because `reset()` replaces the whole state in one `set`.
- **Upload.** `upload.ts` builds the `text/plain` payload and runs the *adaptive* delivery rules (readable reply, or `no-cors` fallback). `outbox.ts` holds one coalesced payload per record, with backoff, and exists only while enrolled.
- **Admin side.** `src/admin/sheetCore.js` (pure, Vitest-tested, runs unchanged inside Apps Script) + `admin/apps-script/wrapper.gs` (Apps Script glue and one-time sheet setup) are concatenated into `admin/apps-script/Code.gs` by `scripts/build-apps-script.mjs`.
- **UI.** A History panel in the Log screen, a Settings overlay behind a header gear, and an enrollment confirmation banner. The bottom bar stays at three tabs.

**Tech Stack:** React 19, TypeScript 7, Zustand 5, Vite 8, Vitest 5 (`environment: 'node'`, tests in `src/**/*.test.ts`), Tailwind v4. Apps Script V8 runtime for `Code.gs`.

**Spec:** `docs/superpowers/specs/2026-10-16-stats-admin-i18n-design.md` (section 5, plus risks in section 8)

## Global Constraints
- No new dependencies. `package.json` changes only by adding the `build:apps-script` script (Task 9) and the description wording (Task 12).
- Tests live in `src/**/*.test.ts` and run in Node; no DOM tests. Shared test helpers live in `src/engine/testing/*.ts` (never import helpers from another `*.test.ts`).
- Engine modules never call `localStorage`, `fetch` or `Date.now()` in a way tests cannot replace: they take `kv`, `fetch`, `now` as arguments.
- The history observer must never throw out of a store `set()` (`reset()` especially) and must never run work that can slow a running code. Writes it does are small and synchronous.
- Upload is OFF until enrolled. No network request, no outbox, no payload is created before enrollment.
- Uploaded `sbar` uses relative `[MM:SS]` times only (no wall-clock, no "Generated:" line), English only, truncated to 60 000 characters.
- Missing or legacy data is `null` / "—"; never a fake 0. Canonical English event labels never change.
- A leading `=`, `+`, `-`, `@`, tab or CR in any exported (CSV) or uploaded (sheet) string is neutralised with a leading `'`.
- Every task ends with `npm run typecheck` and `npm test` green, then a commit.
- **Execution note (this machine):** a GateGuard hook blocks the first Edit/Write of every file until the importers, existing-file check, data shape and the user's instruction are stated. State them, then retry the same call.

## Spec corrections / decisions made by this plan
1. **`buildSbar` gets a `relativeOnly` option** (Task 4). The spec (§5.2) says the uploaded SBAR has relative times only, but today's `buildSbar` prints `Generated: <locale date>`, the activation wall-clock time and `HH:MM:SS` on every timeline row.
2. **`sheetCore` is `.js` + `.d.ts`, not `.ts`** (spec said `.ts`): the build script copies it verbatim into Apps Script, so it must already be plain JavaScript.
3. **No separate feasibility spike.** The user's throwaway Apps Script test was abandoned (their deployment answered "Script function not found: doGet"). The adaptive adapter handles both outcomes, and Settings gets a **Send test record** button that shows which outcome applies. The endpoint check in Task 13 uses `curl`, not the browser pane.
4. **Enrollment hardening:** the stored script URL must match `https://script.google.com/macros/s/<id>/exec` (or the `/a/macros/<domain>/s/<id>/exec` Workspace form). A link or pasted code with any other host is rejected, so a forged link cannot redirect data elsewhere. The enrollment JSON may carry an optional `unit` label (≤ 60 chars) in addition to `{url,key}`.
5. **"ROSC rate" means "any ROSC"** (`rosc` or `rosc_then_terminated`), and is labelled so in the app and the sheet.
6. **Device-owned column `start_month`** (`YYYY-MM` from `startIso`) is added so the Dashboard can group by month without date parsing.
7. **Edits and backfill omit `sbar`**; end-of-code upserts include it. When a payload without `sbar` is coalesced onto an undelivered one that has it, the earlier `sbar` is kept.
8. **History observer is installed from `service.ts`/`main.tsx`, not `store.ts`**, so `store.test.ts` (which imports the store in Node) never loads upload code.
9. The existing suite is **129 tests** (the spec's "96" is stale).

## Review Focus
1. **`reset()` can never throw because of history** — throwing storage, corrupt history JSON, quota full (Task 5 tests).
2. **A code that ends, then is reset, is recorded exactly once** from `prev`, with the right outcome (Task 5).
3. **Unchanged data never re-queues an upload** (`upsertRecord` returns `changed:false`).
4. **Coalescing keeps an undelivered `sbar`**, and an in-flight send never deletes a newer coalesced payload (Task 7).
5. **A revoked / wrong key stops retrying** and surfaces "Enrollment invalid — contact admin"; a schema/version rejection says "Update app".
6. **Admin-owned columns and absent fields are never written** by the script; re-upload after toggling training changes only `training` and `last_upload_iso` (Task 8) — including the live-panel path, where the capture rebuilds the SBAR: the relative-only SBAR must not vary with the training / void flags (Tasks 4 and 5).
7. **Nothing is queued or sent while un-enrolled**; un-enrolling clears the outbox (Task 7).
8. **Enrollment URL allowlist** (Task 1) and the link's `#enroll=` fragment removed from the address bar on every path (Task 11).
9. **CSV/sheet formula injection** and Arabic text survive (Tasks 3, 8).
10. **Retention `after_upload`** deletes only confirmed (`sent`) records, never `sent_unconfirmed`.

---

### Task 1: Storage seam and device preferences (`kv.ts`, `prefs.ts`)

**Files:**
- Create: `src/engine/kv.ts`
- Create: `src/engine/testing/memoryKV.ts`
- Create: `src/engine/prefs.ts`
- Create: `src/engine/prefs.test.ts`

**Interfaces:**
- Produces: `KV { get(key): string|null; set(key, value): boolean; remove(key): void }`, `browserKV(): KV | null`.
- Produces (testing): `memoryKV(seed?): MemoryKV` (`data: Map`, mutable `failWrites`), `throwingKV(): KV`.
- Produces: `Prefs { deviceId; enrollment: Enrollment|null; retention: Retention }`, `Enrollment { url; key; unit: string|null }`, `Retention { mode: 'all'|'last'|'after_upload'; keep: number }`, `DEFAULT_RETENTION`, `KEEP_OPTIONS`, `PREFS_KEY`, `newDeviceId()`, `loadPrefs(kv)`, `savePrefs(kv, prefs)`, `validateEnrollment(x)`, `encodeEnrollment(e)`, `parseEnrollmentCode(text)`, `enrollmentLink(appUrl, e)`.

- [ ] **Step 1: Write the failing test** — `src/engine/prefs.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { memoryKV, throwingKV } from './testing/memoryKV';
import {
  DEFAULT_RETENTION,
  PREFS_KEY,
  enrollmentLink,
  encodeEnrollment,
  loadPrefs,
  parseEnrollmentCode,
  savePrefs,
  validateEnrollment,
} from './prefs';

const URL_OK = 'https://script.google.com/macros/s/AKfycbxAbC_123-xyz/exec';
const KEY_OK = 'unit-icu-2026';

describe('device id and prefs', () => {
  it('creates a 12-hex device id once and keeps it', () => {
    const kv = memoryKV();
    const a = loadPrefs(kv);
    expect(a.deviceId).toMatch(/^[0-9a-f]{12}$/);
    expect(loadPrefs(kv).deviceId).toBe(a.deviceId);
    expect(kv.get(PREFS_KEY)).toContain(a.deviceId);
  });

  it('defaults: not enrolled, keep all', () => {
    const p = loadPrefs(memoryKV());
    expect(p.enrollment).toBeNull();
    expect(p.retention).toEqual(DEFAULT_RETENTION);
  });

  it('recovers from corrupt JSON with defaults and a fresh id', () => {
    const kv = memoryKV({ [PREFS_KEY]: '{not json' });
    expect(loadPrefs(kv).deviceId).toMatch(/^[0-9a-f]{12}$/);
  });

  it('never throws when storage throws', () => {
    expect(() => loadPrefs(throwingKV())).not.toThrow();
    expect(loadPrefs(null).deviceId).toMatch(/^[0-9a-f]{12}$/);
  });

  it('drops an invalid stored enrollment and out-of-range retention', () => {
    const kv = memoryKV({
      [PREFS_KEY]: JSON.stringify({
        deviceId: 'a1b2c3d4e5f6',
        enrollment: { url: 'https://evil.example/exec', key: KEY_OK },
        retention: { mode: 'last', keep: 99999 },
      }),
    });
    const p = loadPrefs(kv);
    expect(p.enrollment).toBeNull();
    expect(p.retention).toEqual({ mode: 'last', keep: DEFAULT_RETENTION.keep });
  });

  it('round-trips through savePrefs', () => {
    const kv = memoryKV();
    const p = loadPrefs(kv);
    expect(
      savePrefs(kv, {
        ...p,
        enrollment: { url: URL_OK, key: KEY_OK, unit: 'ICU' },
        retention: { mode: 'after_upload', keep: 50 },
      }),
    ).toBe(true);
    const q = loadPrefs(kv);
    expect(q.enrollment).toEqual({ url: URL_OK, key: KEY_OK, unit: 'ICU' });
    expect(q.retention.mode).toBe('after_upload');
  });
});

describe('enrollment codes', () => {
  it('round-trips, including a non-Latin unit name', () => {
    const e = { url: URL_OK, key: KEY_OK, unit: 'العناية المركزة' };
    expect(parseEnrollmentCode(encodeEnrollment(e))).toEqual(e);
  });

  it('accepts a pasted full link and a bare enroll= fragment', () => {
    const e = { url: URL_OK, key: KEY_OK, unit: null };
    const link = enrollmentLink('https://drabdo1990.github.io/ACLS-assist/#old', e);
    expect(link.startsWith('https://drabdo1990.github.io/ACLS-assist/#enroll=')).toBe(true);
    expect(parseEnrollmentCode(link)).toEqual(e);
    expect(parseEnrollmentCode(`  ${link.slice(link.indexOf('#') + 1)}\n`)).toEqual(e);
  });

  it('accepts the Workspace URL form', () => {
    const url = 'https://script.google.com/a/macros/hospital.org/s/AKfycbxAbC/exec';
    expect(validateEnrollment({ url, key: KEY_OK })).toEqual({ url, key: KEY_OK, unit: null });
  });

  it.each([
    ['http scheme', 'http://script.google.com/macros/s/AKfycbx/exec'],
    ['other host', 'https://evil.example/macros/s/AKfycbx/exec'],
    ['lookalike host', 'https://script.google.com.evil.com/macros/s/AKfycbx/exec'],
    ['userinfo trick', 'https://script.google.com@evil.com/macros/s/AKfycbx/exec'],
    ['not /exec', 'https://script.google.com/macros/s/AKfycbx/dev'],
    ['query string', 'https://script.google.com/macros/s/AKfycbx/exec?x=1'],
  ])('rejects %s', (_n, url) => {
    expect(validateEnrollment({ url, key: KEY_OK })).toBeNull();
  });

  it('rejects short/invalid keys, long units, garbage', () => {
    expect(validateEnrollment({ url: URL_OK, key: 'short' })).toBeNull();
    expect(validateEnrollment({ url: URL_OK, key: 'has space in it' })).toBeNull();
    expect(validateEnrollment({ url: URL_OK, key: KEY_OK, unit: 'x'.repeat(61) })).toBeNull();
    expect(parseEnrollmentCode('!!!not-base64!!!')).toBeNull();
    expect(parseEnrollmentCode('')).toBeNull();
    expect(parseEnrollmentCode(btoa('{"url":1}'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/prefs.test.ts`
Expected: FAIL — cannot resolve `./testing/memoryKV` / `./prefs`.

- [ ] **Step 3: Implement**

`src/engine/kv.ts`:

```ts
/** Minimal string key/value storage so engine modules can be tested in Node with an in-memory fake. */
export interface KV {
  get(key: string): string | null;
  /** false when the write failed (quota / blocked storage). */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

/** localStorage-backed KV, or null where storage is unavailable (Node, blocked storage). */
export function browserKV(): KV | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
  } catch {
    return null;
  }
  const ls = window.localStorage;
  return {
    get: (k) => {
      try {
        return ls.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        ls.setItem(k, v);
        return true;
      } catch {
        return false;
      }
    },
    remove: (k) => {
      try {
        ls.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };
}
```

`src/engine/testing/memoryKV.ts`:

```ts
import type { KV } from '../kv';

export interface MemoryKV extends KV {
  data: Map<string, string>;
  /** When true, `set` returns false (simulates a full / blocked store). */
  failWrites: boolean;
}

export function memoryKV(seed: Record<string, string> = {}): MemoryKV {
  const data = new Map(Object.entries(seed));
  const kv: MemoryKV = {
    data,
    failWrites: false,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => {
      if (kv.failWrites) return false;
      data.set(k, v);
      return true;
    },
    remove: (k) => {
      data.delete(k);
    },
  };
  return kv;
}

/** A KV whose every call throws — for "history must never break the app" tests. */
export function throwingKV(): KV {
  const boom = (): never => {
    throw new Error('storage exploded');
  };
  return { get: boom, set: boom, remove: boom };
}
```

`src/engine/prefs.ts`:

```ts
/**
 * Device preferences — a separate key from the session, because `reset()` wipes the session
 * (and `Settings` lives inside it). Holds the random device id, the optional upload enrollment
 * and the history retention choice. The enrollment (script URL + key) is never in the repository.
 */
import type { KV } from './kv';

export const PREFS_KEY = 'resuscode.prefs.v1';

export type RetentionMode = 'all' | 'last' | 'after_upload';
export interface Retention {
  mode: RetentionMode;
  /** Used by mode 'last'. */
  keep: number;
}
export interface Enrollment {
  url: string;
  key: string;
  unit: string | null;
}
export interface Prefs {
  deviceId: string;
  enrollment: Enrollment | null;
  retention: Retention;
}

export const DEFAULT_RETENTION: Retention = { mode: 'all', keep: 100 };
export const KEEP_OPTIONS: readonly number[] = [50, 100, 200];

const DEVICE_ID_RE = /^[0-9a-f]{12}$/;
// Only Google Apps Script web-app endpoints: a forged enrollment link must not redirect data elsewhere.
const ENROLL_URL_RE = /^https:\/\/script\.google\.com\/(?:a\/macros\/[A-Za-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/;
const ENROLL_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_UNIT_LEN = 60;

export function newDeviceId(): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function validateEnrollment(x: unknown): Enrollment | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.url !== 'string' || !ENROLL_URL_RE.test(o.url)) return null;
  if (typeof o.key !== 'string' || !ENROLL_KEY_RE.test(o.key)) return null;
  let unit: string | null = null;
  if (o.unit !== undefined && o.unit !== null) {
    if (typeof o.unit !== 'string' || o.unit.length > MAX_UNIT_LEN) return null;
    unit = o.unit.trim() || null;
  }
  return { url: o.url, key: o.key, unit };
}

export function encodeEnrollment(e: Enrollment): string {
  const json = JSON.stringify(e.unit ? { url: e.url, key: e.key, unit: e.unit } : { url: e.url, key: e.key });
  const bin = String.fromCharCode(...new TextEncoder().encode(json));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Accepts the bare code, `enroll=<code>`, or a whole pasted link containing `#enroll=<code>`. */
export function parseEnrollmentCode(input: string): Enrollment | null {
  const m = /enroll=([A-Za-z0-9_-]+)/.exec(input);
  const code = (m ? m[1] : input).trim();
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return validateEnrollment(JSON.parse(json));
  } catch {
    return null;
  }
}

export function enrollmentLink(appUrl: string, e: Enrollment): string {
  return `${appUrl.split('#')[0]}#enroll=${encodeEnrollment(e)}`;
}

function sanitizeRetention(x: unknown): Retention {
  if (typeof x !== 'object' || x === null) return { ...DEFAULT_RETENTION };
  const o = x as Record<string, unknown>;
  const mode: RetentionMode = o.mode === 'last' || o.mode === 'after_upload' ? o.mode : 'all';
  const keep =
    typeof o.keep === 'number' && Number.isInteger(o.keep) && o.keep >= 10 && o.keep <= 500
      ? o.keep
      : DEFAULT_RETENTION.keep;
  return { mode, keep };
}

export function savePrefs(kv: KV, prefs: Prefs): boolean {
  return kv.set(PREFS_KEY, JSON.stringify(prefs));
}

/** Never throws: unreadable / corrupt / absent storage yields defaults (and a fresh device id). */
export function loadPrefs(kv: KV | null): Prefs {
  let raw: Record<string, unknown> = {};
  try {
    const s = kv?.get(PREFS_KEY);
    if (s) {
      const p: unknown = JSON.parse(s);
      if (p && typeof p === 'object' && !Array.isArray(p)) raw = p as Record<string, unknown>;
    }
  } catch {
    /* corrupt → defaults */
  }
  const known = typeof raw.deviceId === 'string' && DEVICE_ID_RE.test(raw.deviceId) ? raw.deviceId : null;
  const prefs: Prefs = {
    deviceId: known ?? newDeviceId(),
    enrollment: validateEnrollment(raw.enrollment),
    retention: sanitizeRetention(raw.retention),
  };
  if (known == null && kv) {
    try {
      savePrefs(kv, prefs);
    } catch {
      /* storage unavailable — id lives for this load only */
    }
  }
  return prefs;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/prefs.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit** — `git add src/engine/kv.ts src/engine/prefs.ts src/engine/prefs.test.ts src/engine/testing/memoryKV.ts && git commit -m "feat: storage seam and device prefs with hardened enrollment parsing"`

---

### Task 2: History core and shared test fixtures (`history.ts`)

**Files:**
- Create: `src/engine/history.ts`
- Create: `src/engine/history.test.ts`
- Create: `src/engine/testing/fixtures.ts`

**Interfaces:**
- Consumes: `computeCodeStats`, `CodeStats` (`stats.ts`), `KV`, `Retention`, `DEFAULT_RETENTION` (`prefs.ts`).
- Produces: `HISTORY_KEY`, `HISTORY_CAP = 500`, `UploadStatus`, `CodeRecord`, `RecordContext`, `makeRecordId`, `isoWithOffset(ms, offsetMin?)`, `shouldRecord(stats)`, `buildRecord(session, now, ctx)`, `loadHistory(kv)`, `upsertRecord(kv, record, retention?) → { records, record, changed, saved }`, `updateRecord(kv, id, patch, retention?)`, `applyRetention(records, retention)`, `clearHistory(kv)`, `median(values)`, `Median`, `computeAggregates(records)`, `Aggregates`.
- Produces (testing): `T0`, `DEVICE`, `mkStats(overrides)`, `mkRecord(n, recordOverrides, statsOverrides)`, `endedSession(overrides)`.

- [ ] **Step 1: Write the shared fixtures** — `src/engine/testing/fixtures.ts`

```ts
import { emptySession } from '../persistence';
import { EPI_INTERVAL_FLAG_MS, STATS_VERSION, type CodeStats } from '../stats';
import type { CodeRecord } from '../history';
import type { PersistedSession } from '../types';

export const T0 = 1_700_000_000_000;
export const DEVICE = 'a1b2c3d4e5f6';

export function mkStats(o: Partial<CodeStats> = {}): CodeStats {
  const startedAt = o.startedAt ?? T0;
  return {
    statsVersion: STATS_VERSION,
    startedAt,
    endedAt: startedAt + 600_000,
    arrestMs: 600_000,
    outcome: 'rosc',
    roscCount: 1,
    firstRoscMs: 600_000,
    firstShockMs: 90_000,
    firstEpiMs: 120_000,
    branchAtFirstEpi: 'shockable',
    shocks: { count: 2, joules: [200, 200] },
    epi: { count: 3, meanIntervalMs: 200_000, longestIntervalMs: 240_000, flagThresholdMs: EPI_INTERVAL_FLAG_MS, longestExceedsThreshold: false },
    amiodarone: { count: 1, totalMg: 300 },
    lidocaine: { count: 0 },
    magnesium: { count: 0 },
    cycles: 4,
    pausedMs: 20_000,
    airway: { type: 'ETT', firstPlacedMs: 300_000 },
    rhythms: ['VF', 'VF', 'PEA'],
    causes: ['hypoxia'],
    pocus: [],
    postRosc: { done: 2, total: 6 },
    ...o,
  };
}

/** The n-th record of a device: one hour apart, deterministic ids. */
export function mkRecord(n = 0, o: Partial<CodeRecord> = {}, so: Partial<CodeStats> = {}): CodeRecord {
  const startedAt = T0 + n * 3_600_000;
  const stats = mkStats({ startedAt, ...so });
  return {
    id: `${startedAt}-${DEVICE}`,
    deviceId: DEVICE,
    startedAt,
    unit: null,
    stats,
    training: false,
    voided: false,
    uploadStatus: 'local',
    savedAt: startedAt,
    ...o,
  };
}

/** A finished (terminated) 2-minute code with one shock — enough to be recorded. */
export function endedSession(o: Partial<PersistedSession> = {}): PersistedSession {
  return {
    ...emptySession(),
    status: 'terminated',
    startedAt: T0,
    endedAt: T0 + 120_000,
    pausedAt: T0 + 120_000,
    events: [
      { id: 'e1', at: T0, t: 0, category: 'system', label: 'Code Blue activated' },
      { id: 'e2', at: T0 + 60_000, t: 60_000, category: 'shock', label: 'Defibrillation: Shock #1 (200J Biphasic)' },
      { id: 'e3', at: T0 + 120_000, t: 120_000, category: 'system', label: 'Code ended' },
    ],
    shocks: [{ at: T0 + 60_000, t: 60_000, joules: 200, shockable: true }],
    ...o,
  };
}
```

- [ ] **Step 2: Write the failing test** — `src/engine/history.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { memoryKV } from './testing/memoryKV';
import { DEVICE, T0, endedSession, mkRecord, mkStats } from './testing/fixtures';
import { emptySession } from './persistence';
import {
  HISTORY_CAP,
  HISTORY_CORRUPT_KEY,
  HISTORY_KEY,
  applyRetention,
  buildRecord,
  clearHistory,
  computeAggregates,
  isoWithOffset,
  loadHistory,
  median,
  shouldRecord,
  updateRecord,
  upsertRecord,
} from './history';

const ctx = { deviceId: DEVICE, unit: null, uploadStatus: 'local' as const };

const quiet = () =>
  mkStats({
    arrestMs: 10_000,
    roscCount: 0,
    shocks: { count: 0, joules: [] },
    epi: { ...mkStats().epi, count: 0 },
    amiodarone: { count: 0, totalMg: 0 },
    lidocaine: { count: 0 },
    magnesium: { count: 0 },
    airway: { type: null, firstPlacedMs: null },
    rhythms: [],
  });

describe('isoWithOffset', () => {
  it('formats with an explicit UTC offset', () => {
    const ms = Date.UTC(2026, 9, 16, 10, 30, 0);
    expect(isoWithOffset(ms, 180)).toBe('2026-10-16T13:30:00+03:00');
    expect(isoWithOffset(ms, -330)).toBe('2026-10-16T05:00:00-05:30');
    expect(isoWithOffset(ms, 0)).toBe('2026-10-16T10:30:00+00:00');
  });
});

describe('shouldRecord / buildRecord', () => {
  it('records a code of at least 60 s even with nothing logged', () => {
    expect(shouldRecord({ ...quiet(), arrestMs: 60_000 })).toBe(true);
    expect(shouldRecord({ ...quiet(), arrestMs: 59_999 })).toBe(false);
  });
  it('records a short code that has any clinical event', () => {
    expect(shouldRecord(quiet())).toBe(false);
    expect(shouldRecord({ ...quiet(), shocks: { count: 1, joules: [200] } })).toBe(true);
    expect(shouldRecord({ ...quiet(), roscCount: 1 })).toBe(true);
    expect(shouldRecord({ ...quiet(), rhythms: ['VF'] })).toBe(true);
    expect(shouldRecord({ ...quiet(), magnesium: { count: 1 } })).toBe(true);
    expect(shouldRecord({ ...quiet(), airway: { type: 'ETT', firstPlacedMs: 5000 } })).toBe(true);
  });
  it('"End code" alone (10 s, no events) is not recorded', () => {
    const s = endedSession({
      endedAt: T0 + 10_000,
      pausedAt: T0 + 10_000,
      shocks: [],
      events: [{ id: 'x', at: T0, t: 0, category: 'system', label: 'Code ended' }],
    });
    expect(buildRecord(s, T0 + 20_000, ctx)).toBeNull();
  });
  it('builds a record with id, flags and context', () => {
    const r = buildRecord(endedSession({ training: true }), T0 + 200_000, { ...ctx, unit: 'ICU', uploadStatus: 'queued' })!;
    expect(r.id).toBe(`${T0}-${DEVICE}`);
    expect(r).toMatchObject({ deviceId: DEVICE, startedAt: T0, unit: 'ICU', training: true, voided: false, uploadStatus: 'queued', savedAt: T0 + 200_000 });
    expect(r.stats.outcome).toBe('terminated');
  });
  it('a never-started session gives null', () => {
    expect(buildRecord(emptySession(), T0, ctx)).toBeNull();
  });
});

describe('storage', () => {
  it('upserts by id, newest data wins, order is by startedAt', () => {
    const kv = memoryKV();
    upsertRecord(kv, mkRecord(2));
    upsertRecord(kv, mkRecord(1));
    upsertRecord(kv, mkRecord(2, { training: true }));
    const all = loadHistory(kv);
    expect(all.map((r) => r.startedAt)).toEqual([mkRecord(1).startedAt, mkRecord(2).startedAt]);
    expect(all[1].training).toBe(true);
  });

  it('unchanged data is not "changed" and keeps the stored upload status', () => {
    const kv = memoryKV();
    upsertRecord(kv, mkRecord(1, { uploadStatus: 'sent' }));
    const res = upsertRecord(kv, mkRecord(1, { uploadStatus: 'queued', savedAt: 999 }));
    expect(res.changed).toBe(false);
    expect(loadHistory(kv)[0].uploadStatus).toBe('sent');
  });

  it('caps at 500 and drops the oldest', () => {
    const kv = memoryKV();
    for (let i = 0; i < HISTORY_CAP + 5; i++) upsertRecord(kv, mkRecord(i));
    const all = loadHistory(kv);
    expect(all).toHaveLength(HISTORY_CAP);
    expect(all[0].startedAt).toBe(mkRecord(5).startedAt);
  });

  it('500 worst-case records stay under 1 MB', () => {
    const big = (n: number) =>
      mkRecord(n, {}, {
        rhythms: Array.from({ length: 40 }, () => 'Asystole'),
        shocks: { count: 20, joules: Array.from({ length: 20 }, () => 360) },
        causes: ['hypovolemia', 'hypoxia', 'hydrogen_ion', 'hypo_hyperkalemia', 'hypothermia', 'hypoglycemia', 'tension_ptx', 'tamponade', 'toxins', 'thrombosis_pulmonary', 'thrombosis_coronary'],
        pocus: ['effusion', 'rv_strain', 'contractility', 'standstill', 'lung_sliding'],
      });
    const json = JSON.stringify(Array.from({ length: HISTORY_CAP }, (_, i) => big(i)));
    expect(json.length).toBeLessThan(1_000_000);
  });

  it('drops invalid entries one by one; parks unparseable JSON instead of destroying it', () => {
    const kv = memoryKV({ [HISTORY_KEY]: JSON.stringify([mkRecord(1), { id: 5 }, null, mkRecord(2)]) });
    expect(loadHistory(kv)).toHaveLength(2);
    const bad = memoryKV({ [HISTORY_KEY]: '{truncated' });
    expect(loadHistory(bad)).toEqual([]);
    expect(bad.get(HISTORY_CORRUPT_KEY)).toBe('{truncated');
  });

  it('reports a failed write', () => {
    const kv = memoryKV();
    kv.failWrites = true;
    expect(upsertRecord(kv, mkRecord(1)).saved).toBe(false);
  });

  it('updateRecord patches flags/status; unknown id is null; clearHistory empties', () => {
    const kv = memoryKV();
    upsertRecord(kv, mkRecord(1));
    expect(updateRecord(kv, mkRecord(1).id, { training: true, uploadStatus: 'queued' })!.training).toBe(true);
    expect(updateRecord(kv, 'nope', { voided: true })).toBeNull();
    clearHistory(kv);
    expect(loadHistory(kv)).toEqual([]);
  });
});

describe('retention', () => {
  const recs = [
    mkRecord(1, { uploadStatus: 'sent' }),
    mkRecord(2, { uploadStatus: 'sent_unconfirmed' }),
    mkRecord(3, { uploadStatus: 'queued' }),
    mkRecord(4, { uploadStatus: 'local' }),
  ];
  it('all keeps everything', () => expect(applyRetention(recs, { mode: 'all', keep: 100 })).toHaveLength(4));
  it('last N keeps the newest N', () =>
    expect(applyRetention(recs, { mode: 'last', keep: 2 }).map((r) => r.startedAt)).toEqual([mkRecord(3).startedAt, mkRecord(4).startedAt]));
  it('after_upload removes only confirmed (sent) records', () => {
    expect(applyRetention(recs, { mode: 'after_upload', keep: 100 }).map((r) => r.uploadStatus)).toEqual(['sent_unconfirmed', 'queued', 'local']);
  });
  it('is applied when a status turns sent', () => {
    const kv = memoryKV();
    upsertRecord(kv, mkRecord(1, { uploadStatus: 'queued' }));
    updateRecord(kv, mkRecord(1).id, { uploadStatus: 'sent' }, { mode: 'after_upload', keep: 100 });
    expect(loadHistory(kv)).toEqual([]);
  });
});

describe('aggregates', () => {
  it('median handles empty, odd, even, and ignores nulls', () => {
    expect(median([])).toEqual({ value: null, n: 0 });
    expect(median([null, null])).toEqual({ value: null, n: 0 });
    expect(median([3, 1, 2])).toEqual({ value: 2, n: 3 });
    expect(median([1, 2, 3, null, 10])).toEqual({ value: 3, n: 4 });
  });

  it('excludes training, void and incomplete; counts them separately', () => {
    const a = computeAggregates([
      mkRecord(1),
      mkRecord(2, { training: true }),
      mkRecord(3, { voided: true }),
      mkRecord(4, {}, { outcome: 'incomplete', roscCount: 0 }),
      mkRecord(5, {}, { outcome: 'terminated', roscCount: 0 }),
    ]);
    expect(a).toMatchObject({ counted: 2, excluded: 2, incomplete: 1, anyRosc: 1, showRates: false });
  });

  it('shows rates only when n >= 5, and counts "any ROSC" including rosc_then_terminated', () => {
    const rs = [
      mkRecord(1, {}, { outcome: 'rosc' }),
      mkRecord(2, {}, { outcome: 'rosc_then_terminated' }),
      mkRecord(3, {}, { outcome: 'terminated', roscCount: 0 }),
      mkRecord(4, {}, { outcome: 'terminated', roscCount: 0 }),
      mkRecord(5, {}, { outcome: 'terminated', roscCount: 0 }),
    ];
    const a = computeAggregates(rs);
    expect(a).toMatchObject({ counted: 5, anyRosc: 2, showRates: true });
    expect(a.roscRate).toBeCloseTo(0.4);
  });

  it('medians skip null metrics and report their own n', () => {
    const a = computeAggregates([
      mkRecord(1, {}, { firstEpiMs: 100_000 }),
      mkRecord(2, {}, { firstEpiMs: null }),
      mkRecord(3, {}, { firstEpiMs: 200_000 }),
    ]);
    expect(a.firstEpi).toEqual({ value: 150_000, n: 2 });
  });

  it('empty history is all zero / null, never NaN', () => {
    expect(computeAggregates([])).toMatchObject({ counted: 0, roscRate: null, showRates: false, firstEpi: { value: null, n: 0 } });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/engine/history.test.ts`
Expected: FAIL — cannot resolve `./history`.

- [ ] **Step 4: Implement** — `src/engine/history.ts`

```ts
/**
 * Device history — a compact record of each finished code (statistics only, no event log), kept in
 * localStorage under `resuscode.history.v1`. Pure over an injected KV. Spec §5.1.
 */
import type { PersistedSession } from './types';
import { computeCodeStats, type CodeStats } from './stats';
import type { KV } from './kv';
import { DEFAULT_RETENTION, type Retention } from './prefs';

export const HISTORY_KEY = 'resuscode.history.v1';
/** Where an unparseable history is parked so it is never silently destroyed. */
export const HISTORY_CORRUPT_KEY = 'resuscode.history.v1.corrupt';
export const HISTORY_CAP = 500;
export const MIN_RECORD_ARREST_MS = 60_000;
/** Aggregates show counts instead of rates below this many counted codes. */
export const MIN_RATE_N = 5;

export type UploadStatus = 'local' | 'queued' | 'sent' | 'sent_unconfirmed' | 'failed' | 'rejected';

export interface CodeRecord {
  id: string;
  deviceId: string;
  startedAt: number;
  unit: string | null;
  stats: CodeStats;
  training: boolean;
  voided: boolean;
  uploadStatus: UploadStatus;
  savedAt: number;
}

export interface RecordContext {
  deviceId: string;
  unit: string | null;
  uploadStatus: UploadStatus;
}

export const makeRecordId = (startedAt: number, deviceId: string): string => `${startedAt}-${deviceId}`;

/** ISO-8601 with an explicit UTC offset (e.g. 2026-10-16T13:30:00+03:00). */
export function isoWithOffset(ms: number, offsetMin: number = -new Date(ms).getTimezoneOffset()): string {
  const d = new Date(ms + offsetMin * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  const a = Math.abs(offsetMin);
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}` +
    `${offsetMin >= 0 ? '+' : '-'}${p(Math.floor(a / 60))}:${p(a % 60)}`
  );
}

/** Spec §5.1: ≥ 60 s of arrest, or any shock / drug / airway / rhythm / ROSC. "End code" alone does not count. */
export function shouldRecord(st: CodeStats): boolean {
  return (
    st.arrestMs >= MIN_RECORD_ARREST_MS ||
    st.shocks.count > 0 ||
    st.epi.count > 0 ||
    st.amiodarone.count > 0 ||
    st.lidocaine.count > 0 ||
    st.magnesium.count > 0 ||
    st.airway.type != null ||
    st.rhythms.length > 0 ||
    st.roscCount > 0
  );
}

export function buildRecord(s: PersistedSession, now: number, ctx: RecordContext): CodeRecord | null {
  const stats = computeCodeStats(s, now);
  if (!stats || !shouldRecord(stats)) return null;
  return {
    id: makeRecordId(stats.startedAt, ctx.deviceId),
    deviceId: ctx.deviceId,
    startedAt: stats.startedAt,
    unit: ctx.unit,
    stats,
    training: s.training,
    voided: s.voided,
    uploadStatus: ctx.uploadStatus,
    savedAt: now,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const OUTCOMES: ReadonlySet<string> = new Set(['rosc', 'rosc_then_terminated', 'terminated', 'incomplete']);
const STATUSES: ReadonlySet<string> = new Set(['local', 'queued', 'sent', 'sent_unconfirmed', 'failed', 'rejected']);

function sanitizeRecord(x: unknown): CodeRecord | null {
  if (!isObj(x)) return null;
  if (typeof x.id !== 'string' || typeof x.deviceId !== 'string' || !isNum(x.startedAt) || !isNum(x.savedAt)) return null;
  if (typeof x.training !== 'boolean' || typeof x.voided !== 'boolean') return null;
  if (typeof x.uploadStatus !== 'string' || !STATUSES.has(x.uploadStatus)) return null;
  if (!(x.unit === null || typeof x.unit === 'string')) return null;
  const st = x.stats;
  if (!isObj(st) || typeof st.outcome !== 'string' || !OUTCOMES.has(st.outcome) || !isNum(st.arrestMs) || !isNum(st.startedAt)) return null;
  // nested members the formatters / CSV / aggregates dereference must exist
  if (!isObj(st.shocks) || !isObj(st.epi) || !isObj(st.amiodarone) || !isObj(st.lidocaine) || !isObj(st.magnesium) || !isObj(st.airway)) return null;
  if (!Array.isArray(st.rhythms) || !Array.isArray(st.causes) || !Array.isArray(st.pocus)) return null;
  return x as unknown as CodeRecord;
}

export function loadHistory(kv: KV): CodeRecord[] {
  const raw = kv.get(HISTORY_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!Array.isArray(parsed)) {
    kv.set(HISTORY_CORRUPT_KEY, raw);
    return [];
  }
  const byId = new Map<string, CodeRecord>();
  for (const x of parsed) {
    const r = sanitizeRecord(x);
    if (r) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => a.startedAt - b.startedAt);
}

export function applyRetention(records: CodeRecord[], r: Retention): CodeRecord[] {
  let kept = [...records].sort((a, b) => a.startedAt - b.startedAt);
  if (r.mode === 'after_upload') kept = kept.filter((x) => x.uploadStatus !== 'sent');
  if (r.mode === 'last') kept = kept.slice(-r.keep);
  return kept.slice(-HISTORY_CAP);
}

function persist(kv: KV, records: CodeRecord[], retention: Retention): { kept: CodeRecord[]; saved: boolean } {
  const kept = applyRetention(records, retention);
  return { kept, saved: kv.set(HISTORY_KEY, JSON.stringify(kept)) };
}

export interface UpsertResult {
  records: CodeRecord[];
  record: CodeRecord;
  /** false when the incoming data equals what is stored (the stored upload status is kept). */
  changed: boolean;
  saved: boolean;
}

const dataKey = (r: CodeRecord) => JSON.stringify([r.stats, r.training, r.voided, r.unit]);

/** Read-modify-write at write time (never from a cached copy), so two tabs converge on one row per id. */
export function upsertRecord(kv: KV, incoming: CodeRecord, retention: Retention = DEFAULT_RETENTION): UpsertResult {
  const all = loadHistory(kv);
  const i = all.findIndex((r) => r.id === incoming.id);
  if (i >= 0 && dataKey(all[i]) === dataKey(incoming)) return { records: all, record: all[i], changed: false, saved: true };
  if (i >= 0) all[i] = incoming;
  else all.push(incoming);
  const { kept, saved } = persist(kv, all, retention);
  return { records: kept, record: incoming, changed: true, saved };
}

export type RecordPatch = Partial<Pick<CodeRecord, 'training' | 'voided' | 'uploadStatus' | 'unit'>>;

export function updateRecord(kv: KV, id: string, patch: RecordPatch, retention: Retention = DEFAULT_RETENTION): CodeRecord | null {
  const all = loadHistory(kv);
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i], ...patch };
  persist(kv, all, retention);
  return all[i];
}

export function clearHistory(kv: KV): void {
  kv.remove(HISTORY_KEY);
}

export interface Median {
  value: number | null;
  /** how many records had this metric */
  n: number;
}

export function median(values: Array<number | null | undefined>): Median {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { value: null, n: 0 };
  const mid = Math.floor(v.length / 2);
  return { value: v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2), n: v.length };
}

export interface Aggregates {
  total: number;
  /** real, finished, not voided: the denominator for every rate */
  counted: number;
  /** training or voided */
  excluded: number;
  /** real, not voided, but code not ended */
  incomplete: number;
  /** counted codes with at least one ROSC (rosc + rosc_then_terminated) */
  anyRosc: number;
  roscRate: number | null;
  /** false when counted < MIN_RATE_N: show counts, not percentages */
  showRates: boolean;
  firstEpi: Median;
  firstShock: Median;
  arrest: Median;
}

export function computeAggregates(records: CodeRecord[]): Aggregates {
  const excluded = records.filter((r) => r.training || r.voided);
  const live = records.filter((r) => !r.training && !r.voided);
  const incomplete = live.filter((r) => r.stats.outcome === 'incomplete');
  const counted = live.filter((r) => r.stats.outcome !== 'incomplete');
  const anyRosc = counted.filter((r) => r.stats.outcome === 'rosc' || r.stats.outcome === 'rosc_then_terminated').length;
  return {
    total: records.length,
    counted: counted.length,
    excluded: excluded.length,
    incomplete: incomplete.length,
    anyRosc,
    roscRate: counted.length ? anyRosc / counted.length : null,
    showRates: counted.length >= MIN_RATE_N,
    firstEpi: median(counted.map((r) => r.stats.firstEpiMs)),
    firstShock: median(counted.map((r) => r.stats.firstShockMs)),
    arrest: median(counted.map((r) => r.stats.arrestMs)),
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/engine/history.test.ts && npm run typecheck && npm test`
Expected: PASS (the 129 existing tests plus the new ones). If the size-budget test fails, shorten the stored stats (e.g. drop the duplicated `startedAt`/`statsVersion` from persisted records) rather than raising the budget.

- [ ] **Step 6: Commit** — `git add src/engine/history.ts src/engine/history.test.ts src/engine/testing/fixtures.ts && git commit -m "feat: device history core (record rule, upsert, retention, aggregates)"`

---

### Task 3: CSV export (`csv.ts`)

**Files:**
- Create: `src/engine/csv.ts`
- Create: `src/engine/csv.test.ts`

**Interfaces:**
- Consumes: `CodeRecord`, `isoWithOffset` (`history.ts`).
- Produces: `csvCell(v)`, `recordsToCsv(records, offsetMin?) → string` (UTF-8 BOM first, CRLF line ends, header row), `csvFilename(now)`.

- [ ] **Step 1: Write the failing test** — `src/engine/csv.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { csvCell, csvFilename, recordsToCsv } from './csv';
import { mkRecord } from './testing/fixtures';

describe('csvCell', () => {
  it('quotes commas, quotes, CR and LF per RFC 4180', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
    expect(csvCell('plain')).toBe('plain');
  });
  it('renders null as empty, booleans as TRUE/FALSE, numbers as-is', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(true)).toBe('TRUE');
    expect(csvCell(false)).toBe('FALSE');
    expect(csvCell(-5)).toBe('-5');
  });
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])('neutralises leading %j', (s) => {
    expect(csvCell(s).replace(/^"/, '').startsWith("'")).toBe(true);
  });
});

describe('recordsToCsv', () => {
  it('starts with a UTF-8 BOM and uses CRLF', () => {
    const out = recordsToCsv([mkRecord(1)], 0);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.split('\r\n')).toHaveLength(2);
  });
  it('has one header per value and flattens a record', () => {
    const [head, row] = recordsToCsv([mkRecord(1, { unit: 'ICU', training: true })], 0).slice(1).split('\r\n');
    const cols = head.split(',');
    const vals = row.split(',');
    expect(vals.length).toBe(cols.length);
    expect(vals[cols.indexOf('unit')]).toBe('ICU');
    expect(vals[cols.indexOf('training')]).toBe('TRUE');
    expect(vals[cols.indexOf('outcome')]).toBe('rosc');
    expect(vals[cols.indexOf('arrest_s')]).toBe('600');
    expect(vals[cols.indexOf('start_iso')]).toBe('2023-11-14T23:13:20+00:00');
  });
  it('keeps Arabic text and neutralises an injected unit name', () => {
    const out = recordsToCsv([mkRecord(1, { unit: '=HYPERLINK("x")' }), mkRecord(2, { unit: 'العناية' })], 0);
    expect(out).toContain('العناية');
    expect(out).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('empty history is just the header row', () => {
    expect(recordsToCsv([], 0).slice(1).split('\r\n')).toHaveLength(1);
  });
  it('filename is dated', () => {
    expect(csvFilename(Date.UTC(2026, 9, 16, 8, 5))).toMatch(/^resuscode-history-\d{8}\.csv$/);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/engine/csv.test.ts` → FAIL (cannot resolve `./csv`).

- [ ] **Step 3: Implement** — `src/engine/csv.ts`

```ts
/** CSV export of the device history: UTF-8 BOM (so Excel reads Arabic), RFC 4180, formula-injection safe. */
import { isoWithOffset, type CodeRecord } from './history';

type Cell = string | number | boolean | null | undefined;

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const sec = (ms: number | null) => (ms == null ? null : Math.round(ms / 1000));
const list = (a: string[]) => a.join('; ');

const COLUMNS: Array<[string, (r: CodeRecord, offsetMin?: number) => Cell]> = [
  ['record_id', (r) => r.id],
  ['device_id', (r) => r.deviceId],
  ['unit', (r) => r.unit],
  ['start_iso', (r, o) => isoWithOffset(r.startedAt, o)],
  ['start_epoch_ms', (r) => r.startedAt],
  ['outcome', (r) => r.stats.outcome],
  ['training', (r) => r.training],
  ['voided', (r) => r.voided],
  ['arrest_s', (r) => sec(r.stats.arrestMs)],
  ['first_rosc_s', (r) => sec(r.stats.firstRoscMs)],
  ['first_shock_s', (r) => sec(r.stats.firstShockMs)],
  ['first_epi_s', (r) => sec(r.stats.firstEpiMs)],
  ['branch_at_first_epi', (r) => r.stats.branchAtFirstEpi],
  ['shock_count', (r) => r.stats.shocks.count],
  ['shock_joules', (r) => r.stats.shocks.joules.join(' ')],
  ['epi_count', (r) => r.stats.epi.count],
  ['epi_mean_interval_s', (r) => sec(r.stats.epi.meanIntervalMs)],
  ['epi_longest_interval_s', (r) => sec(r.stats.epi.longestIntervalMs)],
  ['epi_interval_over_5min', (r) => r.stats.epi.longestExceedsThreshold],
  ['amiodarone_count', (r) => r.stats.amiodarone.count],
  ['amiodarone_mg', (r) => r.stats.amiodarone.totalMg],
  ['lidocaine_count', (r) => r.stats.lidocaine.count],
  ['magnesium_count', (r) => r.stats.magnesium.count],
  ['cycles', (r) => r.stats.cycles],
  ['paused_s', (r) => sec(r.stats.pausedMs)],
  ['airway_type', (r) => r.stats.airway.type],
  ['airway_first_s', (r) => sec(r.stats.airway.firstPlacedMs)],
  ['rhythms', (r) => list(r.stats.rhythms)],
  ['causes', (r) => list(r.stats.causes)],
  ['pocus', (r) => list(r.stats.pocus)],
  ['post_rosc', (r) => (r.stats.postRosc ? `${r.stats.postRosc.done}/${r.stats.postRosc.total}` : null)],
  ['upload_status', (r) => r.uploadStatus],
];

/** `offsetMin` pins the UTC offset used for `start_iso` (tests); default is the device's. */
export function recordsToCsv(records: CodeRecord[], offsetMin?: number): string {
  const lines = [COLUMNS.map(([name]) => name).join(',')];
  for (const r of records) lines.push(COLUMNS.map(([, get]) => csvCell(get(r, offsetMin))).join(','));
  return `﻿${lines.join('\r\n')}`;
}

export function csvFilename(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `resuscode-history-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.csv`;
}
```

- [ ] **Step 4: Run** — `npx vitest run src/engine/csv.test.ts && npm run typecheck && npm test` → PASS.

- [ ] **Step 5: Commit** — `git add src/engine/csv.ts src/engine/csv.test.ts && git commit -m "feat: history CSV export (BOM, RFC 4180, injection-safe)"`

---

### Task 4: Relative-time SBAR for upload (`buildSbar` option)

**Files:**
- Modify: `src/engine/sbar.ts`
- Modify: `src/engine/sbar.test.ts`

**Interfaces:**
- Produces: `buildSbar(input, now?, opts?: { relativeOnly?: boolean })`. Default output is byte-for-byte unchanged.

- [ ] **Step 1: Write the failing tests** — append to `src/engine/sbar.test.ts` (keep the file's existing imports; add `formatWallClock` from `./timing` if not imported):

```ts
describe('buildSbar relativeOnly (upload variant)', () => {
  const T = 1_700_000_000_000;
  const input = {
    status: 'rosc' as const,
    startedAt: T,
    endedAt: T + 300_000,
    roscAccumMs: 0,
    events: [
      { id: '1', at: T, t: 0, category: 'system' as const, label: 'Code Blue activated' },
      { id: '2', at: T + 300_000, t: 300_000, category: 'rosc' as const, label: 'ROSC declared', detail: 'Total arrest duration: 5m 0s.' },
    ],
    shocks: [],
    epi: [],
    amio: [],
    lido: [],
    rhythmBranch: null,
    airwayPlaced: false,
    airwayType: null,
    causes: {},
    pocus: {},
    weightKg: 70,
  };
  it('has no Generated line and no wall-clock timestamps', () => {
    const out = buildSbar(input, T + 400_000, { relativeOnly: true });
    expect(out).not.toContain('Generated:');
    expect(out).not.toContain(formatWallClock(T));
    expect(out).not.toContain(formatWallClock(T + 300_000));
    expect(out).toContain('[00:00]');
    expect(out).toContain('[05:00]');
    expect(out).toContain('ROSC achieved at [05:00].');
  });
  it('default output is unchanged (still has Generated and wall-clock)', () => {
    const out = buildSbar(input, T + 400_000);
    expect(out).toContain('Generated:');
    expect(out).toContain(formatWallClock(T));
  });
  it('does not vary with the training / void flags: they are separate sheet columns, so toggling one must not rewrite the SBAR cell', () => {
    const withStats = { ...input, stats: mkStats({ startedAt: T }) };
    const a = buildSbar({ ...withStats, training: false, voided: false }, T + 400_000, { relativeOnly: true });
    const b = buildSbar({ ...withStats, training: true, voided: true }, T + 400_000, { relativeOnly: true });
    expect(b).toBe(a);
    expect(a).not.toContain('TRAINING / SIMULATION');
    // the on-screen / pasted SBAR still shows the flags
    expect(buildSbar({ ...withStats, training: true }, T + 400_000)).toContain('TRAINING / SIMULATION');
    expect(buildSbar({ ...withStats, voided: true }, T + 400_000)).toContain('VOIDED');
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/engine/sbar.test.ts` → FAIL (third argument ignored, so the `Generated:` assertion fails).

- [ ] **Step 3: Implement** in `src/engine/sbar.ts`:
  - Add `export interface SbarOptions { relativeOnly?: boolean }`.
  - Change `line(e)` to `line(e: CodeEvent, relativeOnly: boolean)`; when `relativeOnly`, return `` `[${formatClock(e.t)}]  ${e.label}${e.detail ? ` — ${e.detail}` : ''}` `` (no `formatWallClock`).
  - Change the signature to `buildSbar(input: SbarInput, now: number = Date.now(), opts: SbarOptions = {})` and set `const rel = !!opts.relativeOnly`.
  - `Generated:` line: `if (!rel) out.push(\`Generated: ${new Date(now).toLocaleString()}\`);`
  - SITUATION: when `rel`, push `Arrest duration: ${formatDuration(total)}.` instead of the `Code activated at ${formatWallClock(...)}` line; the ROSC line becomes `ROSC achieved at [${formatClock(rosc.t)}].` when `rel`.
  - Timeline loop: `out.push(line(e, rel))`.
  - CODE STATISTICS section: when `rel`, do **not** emit the `TRAINING / SIMULATION — not a real patient` and `VOIDED — excluded from statistics` lines. Both flags are their own sheet columns (`training`, `void`); if the SBAR text varied with them, toggling training on the live stats panel (which re-captures and rebuilds the SBAR) would rewrite the SBAR cell and break the spec's "re-upload after toggling training changes only the `training` cell".
  - Leave every other line untouched so the existing tests stay green.
  - Add `import { mkStats } from './testing/fixtures';` to `sbar.test.ts` (and `formatWallClock` from `./timing` if it is not imported yet).

- [ ] **Step 4: Run** — `npx vitest run src/engine/sbar.test.ts && npm run typecheck && npm test` → PASS.

- [ ] **Step 5: Commit** — `git add src/engine/sbar.ts src/engine/sbar.test.ts && git commit -m "feat: relative-time SBAR variant for upload"`

### Task 5: History capture observer (`historyCapture.ts`)

**Files:**
- Create: `src/engine/historyCapture.ts`
- Create: `src/engine/historyCapture.test.ts`
- Modify: `src/engine/persistence.ts` (export `reportSaveStatus` so a history write failure lights the existing NOT SAVED chip)

**Interfaces:**
- Consumes: `buildRecord`, `upsertRecord`, `CodeRecord` (`history.ts`), `loadPrefs` (`prefs.ts`), `buildSbar` (`sbar.ts`), `KV`.
- Produces: `CaptureState = PersistedSession & { rev: number }`, `CaptureDeps { kv; now; onRecorded?(record, sbar); onChanged?() }`, `createCapture(deps) → { handle(state, prev); flush() }`, `installHistoryCapture(store, deps) → dispose`, `requestPersistentStorage()`, `DEBOUNCE_MS = 1000`, `reportSaveStatus(ok)`.

**Behaviour (spec §5.1):**
- Reset (`prev.startedAt != null && state.startedAt == null`): record from `prev`, cancel any pending debounce.
- Otherwise act only when `rev` changed (a `tick` changes `now`, not `rev`).
- Status becomes — or changes between — `rosc` / `terminated`: record immediately.
- Any other mutation while already terminal/ROSC: debounced 1 s record of the latest state.
- Back to `active` (re-arrest): cancel the debounce; record nothing (the final state is recorded when the code ends or is reset).
- The whole body is `try/catch` → `console.error`; it must never throw. History write failures call `reportSaveStatus(false)`.
- `onRecorded` fires only when the data actually changed **and** the device is enrolled (status is `queued`, otherwise `local`), with a relative-time English SBAR.

- [ ] **Step 1: Write the failing test** — `src/engine/historyCapture.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryKV, throwingKV } from './testing/memoryKV';
import { T0, endedSession } from './testing/fixtures';
import { emptySession, getSaveOk, reportSaveStatus } from './persistence';
import { loadHistory } from './history';
import { loadPrefs, savePrefs } from './prefs';
import { DEBOUNCE_MS, createCapture, type CaptureState } from './historyCapture';

const URL_OK = 'https://script.google.com/macros/s/AKfycbxAbC/exec';

const active = (o: Partial<CaptureState> = {}): CaptureState => ({
  ...emptySession(),
  status: 'active',
  startedAt: T0,
  events: [{ id: 'e1', at: T0, t: 0, category: 'system', label: 'Code Blue activated' }],
  rev: 3,
  ...o,
});
const ended = (o: Partial<CaptureState> = {}): CaptureState => ({ ...endedSession(), rev: 5, ...o });
const roscSession = (o: Partial<CaptureState> = {}): CaptureState =>
  ended({
    status: 'rosc',
    events: [
      { id: 'e1', at: T0, t: 0, category: 'system', label: 'Code Blue activated' },
      { id: 'e2', at: T0 + 60_000, t: 60_000, category: 'rosc', label: 'ROSC declared' },
    ],
    endedAt: T0 + 60_000,
    pausedAt: T0 + 60_000,
    shocks: [],
    ...o,
  });
const enroll = (kv: ReturnType<typeof memoryKV>) =>
  savePrefs(kv, { ...loadPrefs(kv), enrollment: { url: URL_OK, key: 'unit-icu-2026', unit: 'ICU' } });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  reportSaveStatus(true);
});

describe('history capture', () => {
  it('records once when the code reaches a terminal status', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(ended(), active({ rev: 4 }));
    const all = loadHistory(kv);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ startedAt: T0, uploadStatus: 'local', training: false });
    expect(all[0].stats.outcome).toBe('terminated');
  });

  it('ignores ticks (same rev) and non-terminal mutations', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(ended({ rev: 5 }), ended({ rev: 5 }));
    cap.handle(active({ rev: 4 }), active({ rev: 3 }));
    expect(loadHistory(kv)).toEqual([]);
  });

  it('records on reset from prev (state is already empty)', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle({ ...emptySession(), rev: 0 }, ended({ rev: 9 }));
    const all = loadHistory(kv);
    expect(all).toHaveLength(1);
    expect(all[0].startedAt).toBe(T0);
  });

  it('records an incomplete code that is reset mid-arrest', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 300_000 });
    cap.handle({ ...emptySession(), rev: 0 }, active({ rev: 7 }));
    expect(loadHistory(kv)[0].stats.outcome).toBe('incomplete');
  });

  it('does not record a trivial code (10 s, nothing logged)', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 10_000 });
    cap.handle({ ...emptySession(), rev: 0 }, active({ rev: 2 }));
    expect(loadHistory(kv)).toEqual([]);
  });

  it('rosc → terminated records immediately (status change), outcome rosc_then_terminated', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(roscSession({ rev: 6 }), active({ rev: 5 }));
    expect(loadHistory(kv)[0].stats.outcome).toBe('rosc');
    cap.handle(roscSession({ status: 'terminated', rev: 7 }), roscSession({ rev: 6 }));
    expect(loadHistory(kv)[0].stats.outcome).toBe('rosc_then_terminated');
    expect(loadHistory(kv)).toHaveLength(1);
  });

  it('debounces mutations made while already ended (training / void toggles)', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(ended(), active({ rev: 4 }));
    cap.handle(ended({ rev: 6, training: true }), ended({ rev: 5 }));
    vi.advanceTimersByTime(500);
    cap.handle(ended({ rev: 7, training: true, voided: true }), ended({ rev: 6, training: true }));
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(loadHistory(kv)[0]).toMatchObject({ training: false, voided: false });
    vi.advanceTimersByTime(1);
    expect(loadHistory(kv)[0]).toMatchObject({ training: true, voided: true });
  });

  it('flush() writes a pending debounced change immediately (pagehide)', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(ended(), active({ rev: 4 }));
    cap.handle(ended({ rev: 6, training: true }), ended({ rev: 5 }));
    cap.flush();
    expect(loadHistory(kv)[0].training).toBe(true);
  });

  it('re-arrest cancels a pending debounce', () => {
    const kv = memoryKV();
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    cap.handle(roscSession({ rev: 6 }), active({ rev: 5 }));
    cap.handle(roscSession({ rev: 7, training: true }), roscSession({ rev: 6 }));
    cap.handle(active({ rev: 8, training: true }), roscSession({ rev: 7, training: true }));
    vi.advanceTimersByTime(5_000);
    expect(loadHistory(kv)[0].training).toBe(false);
  });
});

describe('capture safety', () => {
  it('never throws when storage throws, and logs', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cap = createCapture({ kv: throwingKV(), now: () => T0 + 130_000 });
    expect(() => cap.handle({ ...emptySession(), rev: 0 }, ended({ rev: 9 }))).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });

  it('never throws with no storage at all', () => {
    const cap = createCapture({ kv: null, now: () => T0 + 130_000 });
    expect(() => cap.handle(ended(), active({ rev: 4 }))).not.toThrow();
  });

  it('a full store lights the NOT SAVED status instead of throwing', () => {
    const kv = memoryKV();
    kv.failWrites = true;
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    expect(() => cap.handle(ended(), active({ rev: 4 }))).not.toThrow();
    expect(getSaveOk()).toBe(false);
  });

  it('survives corrupt history JSON', () => {
    const kv = memoryKV({ 'resuscode.history.v1': '{broken' });
    const cap = createCapture({ kv, now: () => T0 + 130_000 });
    expect(() => cap.handle(ended(), active({ rev: 4 }))).not.toThrow();
    expect(loadHistory(kv)).toHaveLength(1);
  });
});

describe('enrollment-aware output', () => {
  it('not enrolled: status local, onRecorded never called', () => {
    const kv = memoryKV();
    const onRecorded = vi.fn();
    createCapture({ kv, now: () => T0 + 130_000, onRecorded }).handle(ended(), active({ rev: 4 }));
    expect(onRecorded).not.toHaveBeenCalled();
    expect(loadHistory(kv)[0].uploadStatus).toBe('local');
  });

  it('enrolled: status queued, onRecorded gets a relative-time SBAR once per real change', () => {
    const kv = memoryKV();
    enroll(kv);
    const onRecorded = vi.fn();
    const cap = createCapture({ kv, now: () => T0 + 130_000, onRecorded });
    cap.handle(ended(), active({ rev: 4 }));
    expect(onRecorded).toHaveBeenCalledTimes(1);
    const [rec, sbar] = onRecorded.mock.calls[0] as [{ uploadStatus: string; unit: string }, string];
    expect(rec).toMatchObject({ uploadStatus: 'queued', unit: 'ICU' });
    expect(sbar).toContain('RESUSCITATION SUMMARY');
    expect(sbar).not.toContain('Generated:');
    // an identical re-capture (rev bump with no data change) does not re-queue
    cap.handle(ended({ rev: 6 }), ended({ rev: 5 }));
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(onRecorded).toHaveBeenCalledTimes(1);
  });

  it('toggling training after the end re-queues the record but the uploaded SBAR text is identical (the sheet keeps its SBAR cell)', () => {
    const kv = memoryKV();
    enroll(kv);
    const onRecorded = vi.fn();
    const cap = createCapture({ kv, now: () => T0 + 130_000, onRecorded });
    cap.handle(ended(), active({ rev: 4 }));
    cap.handle(ended({ rev: 6, training: true }), ended({ rev: 5 }));
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(onRecorded).toHaveBeenCalledTimes(2);
    expect(loadHistory(kv)[0].training).toBe(true);
    expect(onRecorded.mock.calls[1][1]).toBe(onRecorded.mock.calls[0][1]);
  });

  it('onChanged fires after a history write', () => {
    const kv = memoryKV();
    const onChanged = vi.fn();
    createCapture({ kv, now: () => T0 + 130_000, onChanged }).handle(ended(), active({ rev: 4 }));
    expect(onChanged).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/historyCapture.test.ts`
Expected: FAIL — cannot resolve `./historyCapture` / `reportSaveStatus` is not exported.

- [ ] **Step 3: Implement**

In `src/engine/persistence.ts`, next to `setSaveOk`, add:

```ts
/** Lets other storage writers (history) surface a failure through the same NOT SAVED chip. */
export function reportSaveStatus(ok: boolean): void {
  setSaveOk(ok);
}
```

`src/engine/historyCapture.ts`:

```ts
/**
 * History capture — a store observer that turns a finished code into a history record.
 * It must never throw out of a store `set()` (reset() especially) and never block a running code.
 * Spec §5.1.
 */
import type { PersistedSession } from './types';
import type { KV } from './kv';
import { buildRecord, upsertRecord, type CodeRecord } from './history';
import { loadPrefs } from './prefs';
import { buildSbar } from './sbar';
import { reportSaveStatus } from './persistence';

export type CaptureState = PersistedSession & { rev: number };

export interface CaptureDeps {
  kv: KV | null;
  now: () => number;
  /** Enrolled devices only: a record was created or really changed. `sbar` is English with relative times only. */
  onRecorded?: (record: CodeRecord, sbar: string) => void;
  /** After any history write, so the UI can refresh. */
  onChanged?: () => void;
}

export const DEBOUNCE_MS = 1000;

const isTerminal = (s: Pick<PersistedSession, 'status'>) => s.status === 'rosc' || s.status === 'terminated';

export function createCapture(deps: CaptureDeps) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: CaptureState | null = null;

  const cancel = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    latest = null;
  };

  function record(s: CaptureState): void {
    const { kv } = deps;
    if (!kv) return;
    const now = deps.now();
    const prefs = loadPrefs(kv);
    const rec = buildRecord(s, now, {
      deviceId: prefs.deviceId,
      unit: prefs.enrollment?.unit ?? null,
      uploadStatus: prefs.enrollment ? 'queued' : 'local',
    });
    if (!rec) return;
    const res = upsertRecord(kv, rec, prefs.retention);
    if (!res.saved) reportSaveStatus(false);
    if (!res.changed) return;
    deps.onChanged?.();
    if (prefs.enrollment) {
      deps.onRecorded?.(res.record, buildSbar({ ...s, stats: rec.stats }, now, { relativeOnly: true }));
    }
  }

  function guarded(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      console.error('[history] capture failed', e);
    }
  }

  function handle(state: CaptureState, prev: CaptureState): void {
    guarded(() => {
      // reset(): the whole state was replaced, so the finished code only exists in `prev`
      if (prev.startedAt != null && state.startedAt == null) {
        cancel();
        record(prev);
        return;
      }
      if (state.rev === prev.rev) return; // clock tick or no-op
      if (!isTerminal(state)) {
        cancel(); // e.g. re-arrest: the final state is recorded when the code ends or is reset
        return;
      }
      if (!isTerminal(prev) || state.status !== prev.status) {
        cancel();
        record(state);
        return;
      }
      latest = state;
      if (timer != null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const s = latest;
        latest = null;
        if (s) guarded(() => record(s));
      }, DEBOUNCE_MS);
    });
  }

  /** Write a pending debounced change now (pagehide / visibility hidden). */
  function flush(): void {
    guarded(() => {
      if (timer != null) clearTimeout(timer);
      timer = null;
      const s = latest;
      latest = null;
      if (s) record(s);
    });
  }

  return { handle, flush };
}

export function requestPersistentStorage(): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) void navigator.storage.persist().catch(() => {});
  } catch {
    /* best effort */
  }
}

/** Zustand's `subscribe((state, prev) => …)` satisfies this. Returns a disposer. */
export function installHistoryCapture<S extends CaptureState>(
  store: { subscribe(listener: (state: S, prev: S) => void): () => void },
  deps: CaptureDeps,
): () => void {
  const cap = createCapture(deps);
  const unsubscribe = store.subscribe(cap.handle);
  const onHide = () => cap.flush();
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
  }
  requestPersistentStorage();
  return () => {
    unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    }
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/historyCapture.test.ts && npm run typecheck && npm test`
Expected: PASS. (`visibilitychange` flushes even when becoming visible — harmless: `flush` is a no-op with nothing pending.)

- [ ] **Step 5: Commit** — `git add src/engine/historyCapture.ts src/engine/historyCapture.test.ts src/engine/persistence.ts && git commit -m "feat: history capture observer (reset-safe, debounced, never throws)"`

---

### Task 6: Upload payload and adaptive delivery (`upload.ts`)

**Files:**
- Create: `src/engine/upload.ts`
- Create: `src/engine/upload.test.ts`
- Create: `src/engine/testing/fakeFetch.ts`

**Interfaces:**
- Consumes: `CodeRecord`, `isoWithOffset` (`history.ts`), `CodeStats`, `STATS_VERSION`, `EPI_INTERVAL_FLAG_MS` (`stats.ts`).
- Produces: `UploadPayload`, `buildPayload(record, { enrollmentKey, sbar?, offsetMin? })`, `buildTestPayload(deviceId, key, now, offsetMin?)`, `MAX_SBAR_CHARS = 60_000`, `RejectError`, `SendResult`, `SendDeps { fetch; isOnline }`, `sendPayload(payload, url, deps)`.
- Produces (testing): `fakeFetch(...steps) → { fetch, calls }`, `json(body, status?)`.

**Delivery rules (user decision, verbatim from the roadmap memory):**
1. POST `Content-Type: text/plain;charset=utf-8` (never `application/json`: Google's preflight lacks CORS headers), `redirect: 'follow'`.
2. Readable `{ok:true}` → `sent`.
3. Readable `{ok:false,error:'key'|'schema'|'version'|'size'}` → `rejected` (caller stops retrying).
4. HTTP ≥ 500, non-JSON/HTML body, `{ok:false,error:'busy'|…}` → `failed` (caller retries with backoff).
5. `fetch` throws and the device is online (CORS block and network failure look identical) → retry once with `mode:'no-cors'`: resolves → `sent_unconfirmed`; throws → `failed`.
6. `fetch` throws and the device is offline → `failed` (`offline`), no second request.
A CORS-blocked first attempt may have reached the server; the `no-cors` re-send is then a duplicate, which is harmless because the sheet script is idempotent per `record_id`.

- [ ] **Step 1: Write the test helper** — `src/engine/testing/fakeFetch.ts`

```ts
export interface FetchCall {
  url: string;
  init?: RequestInit;
}

/** Sequential scripted `fetch`: each call consumes the next step (the last step repeats). An Error step throws. */
export function fakeFetch(...steps: Array<Response | Error>): { fetch: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  let i = 0;
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    if (step instanceof Error) throw step;
    return step.clone();
  }) as typeof fetch;
  return { fetch: fn, calls };
}

export const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });
export const html = (body = '<html><title>خطأ</title></html>', status = 200): Response => new Response(body, { status });
```

- [ ] **Step 2: Write the failing test** — `src/engine/upload.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { fakeFetch, html, json } from './testing/fakeFetch';
import { DEVICE, T0, mkRecord } from './testing/fixtures';
import { MAX_SBAR_CHARS, buildPayload, buildTestPayload, sendPayload } from './upload';

const URL_OK = 'https://script.google.com/macros/s/AKfycbxAbC/exec';
const KEY = 'unit-icu-2026';
const online = { isOnline: () => true };
const payload = () => buildPayload(mkRecord(1), { enrollmentKey: KEY, offsetMin: 180 });

describe('buildPayload', () => {
  it('maps the record to payload v1', () => {
    const r = mkRecord(1, { training: true, voided: true });
    const p = buildPayload(r, { enrollmentKey: KEY, offsetMin: 180 });
    expect(p).toMatchObject({
      payloadVersion: 1,
      enrollmentKey: KEY,
      recordId: r.id,
      deviceId: DEVICE,
      startEpochMs: r.startedAt,
      training: true,
      voided: true,
    });
    expect(p.startIso).toBe('2023-11-15T02:13:20+03:00');
    expect(p.stats).toBe(r.stats);
  });
  it('omits sbar when not given, truncates it when huge', () => {
    expect('sbar' in payload()).toBe(false);
    const p = buildPayload(mkRecord(1), { enrollmentKey: KEY, sbar: 'x'.repeat(MAX_SBAR_CHARS + 500) });
    expect(p.sbar).toHaveLength(MAX_SBAR_CHARS);
  });
  it('test payload is a flagged TEST- record', () => {
    const p = buildTestPayload(DEVICE, KEY, T0, 0);
    expect(p.recordId).toBe(`TEST-${DEVICE}`);
    expect(p.training).toBe(true);
    expect(p.stats.outcome).toBe('incomplete');
  });
});

describe('sendPayload', () => {
  it('posts text/plain (never JSON content-type, no mode override) and reads {ok:true} as sent', async () => {
    const f = fakeFetch(json({ ok: true }));
    const p = payload();
    expect(await sendPayload(p, URL_OK, { fetch: f.fetch, ...online })).toEqual({ status: 'sent' });
    expect(f.calls).toHaveLength(1);
    const init = f.calls[0].init!;
    expect(f.calls[0].url).toBe(URL_OK);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(init.mode).toBeUndefined();
    expect(JSON.parse(init.body as string)).toEqual(JSON.parse(JSON.stringify(p)));
  });

  it.each(['key', 'schema', 'version', 'size'] as const)('readable {ok:false,error:%s} is rejected', async (error) => {
    const f = fakeFetch(json({ ok: false, error }));
    expect(await sendPayload(payload(), URL_OK, { fetch: f.fetch, ...online })).toEqual({ status: 'rejected', error });
  });

  it('server error pages and busy/unknown errors are retryable failures', async () => {
    for (const step of [html(), html('oops', 500), json({ ok: false, error: 'busy' }), json({ ok: false, error: 'server' }), json({ nope: 1 })]) {
      const f = fakeFetch(step);
      const r = await sendPayload(payload(), URL_OK, { fetch: f.fetch, ...online });
      expect(r.status).toBe('failed');
    }
  });

  it('a throwing fetch while online retries once with no-cors and reports sent_unconfirmed', async () => {
    const f = fakeFetch(new TypeError('Failed to fetch'), new Response(null));
    expect(await sendPayload(payload(), URL_OK, { fetch: f.fetch, ...online })).toEqual({ status: 'sent_unconfirmed' });
    expect(f.calls).toHaveLength(2);
    expect(f.calls[1].init!.mode).toBe('no-cors');
    expect((f.calls[1].init!.headers as Record<string, string>)['Content-Type']).toBe('text/plain;charset=utf-8');
  });

  it('both attempts throwing is a failure', async () => {
    const f = fakeFetch(new TypeError('x'), new TypeError('y'));
    expect(await sendPayload(payload(), URL_OK, { fetch: f.fetch, ...online })).toEqual({ status: 'failed', reason: 'network' });
  });

  it('offline: failed without a second request', async () => {
    const f = fakeFetch(new TypeError('x'));
    expect(await sendPayload(payload(), URL_OK, { fetch: f.fetch, isOnline: () => false })).toEqual({ status: 'failed', reason: 'offline' });
    expect(f.calls).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `npx vitest run src/engine/upload.test.ts` → FAIL (cannot resolve `./upload`).

- [ ] **Step 4: Implement** — `src/engine/upload.ts`

```ts
/**
 * Upload payload and adaptive delivery to the admin's Apps Script web app. Spec §5.2.
 * Pure over an injected `fetch` / `isOnline`, so every branch is unit-tested.
 */
import { isoWithOffset, type CodeRecord } from './history';
import { EPI_INTERVAL_FLAG_MS, STATS_VERSION, type CodeStats } from './stats';

export const PAYLOAD_VERSION = 1;
export const MAX_SBAR_CHARS = 60_000;

export interface UploadPayload {
  payloadVersion: 1;
  enrollmentKey: string;
  recordId: string;
  deviceId: string;
  startEpochMs: number;
  /** with UTC offset */
  startIso: string;
  training: boolean;
  voided: boolean;
  stats: CodeStats;
  /** English, relative times only; omitted for edits and backfill */
  sbar?: string;
}

export interface PayloadOptions {
  enrollmentKey: string;
  sbar?: string;
  offsetMin?: number;
}

export function buildPayload(record: CodeRecord, o: PayloadOptions): UploadPayload {
  const p: UploadPayload = {
    payloadVersion: PAYLOAD_VERSION,
    enrollmentKey: o.enrollmentKey,
    recordId: record.id,
    deviceId: record.deviceId,
    startEpochMs: record.startedAt,
    startIso: isoWithOffset(record.startedAt, o.offsetMin),
    training: record.training,
    voided: record.voided,
    stats: record.stats,
  };
  if (o.sbar !== undefined) p.sbar = o.sbar.slice(0, MAX_SBAR_CHARS);
  return p;
}

/** The "Send test record" payload: a flagged TEST-<deviceId> row that every Dashboard formula ignores. */
export function buildTestPayload(deviceId: string, enrollmentKey: string, now: number, offsetMin?: number): UploadPayload {
  const stats: CodeStats = {
    statsVersion: STATS_VERSION,
    startedAt: now,
    endedAt: now,
    arrestMs: 0,
    outcome: 'incomplete',
    roscCount: 0,
    firstRoscMs: null,
    firstShockMs: null,
    firstEpiMs: null,
    branchAtFirstEpi: null,
    shocks: { count: 0, joules: [] },
    epi: { count: 0, meanIntervalMs: null, longestIntervalMs: null, flagThresholdMs: EPI_INTERVAL_FLAG_MS, longestExceedsThreshold: false },
    amiodarone: { count: 0, totalMg: 0 },
    lidocaine: { count: 0 },
    magnesium: { count: 0 },
    cycles: 0,
    pausedMs: 0,
    airway: { type: null, firstPlacedMs: null },
    rhythms: [],
    causes: [],
    pocus: [],
    postRosc: null,
  };
  return {
    payloadVersion: PAYLOAD_VERSION,
    enrollmentKey,
    recordId: `TEST-${deviceId}`,
    deviceId,
    startEpochMs: now,
    startIso: isoWithOffset(now, offsetMin),
    training: true,
    voided: false,
    stats,
    sbar: 'ResusCode test record — safe to ignore.',
  };
}

export type RejectError = 'key' | 'schema' | 'version' | 'size';
const REJECTS: ReadonlySet<string> = new Set<RejectError>(['key', 'schema', 'version', 'size']);
export const isRejectError = (x: unknown): x is RejectError => typeof x === 'string' && REJECTS.has(x);

export type SendResult =
  | { status: 'sent' }
  | { status: 'rejected'; error: RejectError }
  | { status: 'sent_unconfirmed' }
  | { status: 'failed'; reason: string };

export interface SendDeps {
  fetch: typeof fetch;
  isOnline: () => boolean;
}

const REQUEST_TIMEOUT_MS = 15_000;

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined;
}

async function interpret(res: Response): Promise<SendResult> {
  if (res.status >= 500) return { status: 'failed', reason: `http_${res.status}` };
  let text: string;
  try {
    text = await res.text();
  } catch {
    return { status: 'failed', reason: 'unreadable' };
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { status: 'failed', reason: 'not_json' }; // Google's HTML error pages land here
  }
  const o = (typeof body === 'object' && body !== null ? body : {}) as { ok?: unknown; error?: unknown };
  if (o.ok === true) return { status: 'sent' };
  if (o.ok === false && isRejectError(o.error)) return { status: 'rejected', error: o.error };
  return { status: 'failed', reason: `server_${typeof o.error === 'string' ? o.error : 'unknown'}` };
}

export async function sendPayload(payload: UploadPayload, url: string, deps: SendDeps): Promise<SendResult> {
  const init: RequestInit = {
    method: 'POST',
    // text/plain keeps this a CORS "simple" request: no preflight, which Apps Script cannot answer
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
    signal: timeoutSignal(),
  };
  try {
    return await interpret(await deps.fetch(url, init));
  } catch {
    // A CORS block and a network failure look the same from here.
    if (!deps.isOnline()) return { status: 'failed', reason: 'offline' };
    try {
      await deps.fetch(url, { ...init, mode: 'no-cors', signal: timeoutSignal() });
      return { status: 'sent_unconfirmed' };
    } catch {
      return { status: 'failed', reason: 'network' };
    }
  }
}
```

- [ ] **Step 5: Run** — `npx vitest run src/engine/upload.test.ts && npm run typecheck && npm test` → PASS.

- [ ] **Step 6: Commit** — `git add src/engine/upload.ts src/engine/upload.test.ts src/engine/testing/fakeFetch.ts && git commit -m "feat: upload payload and adaptive text/plain delivery"`

---

### Task 7: Outbox, backfill, enrollment state, and the service layer

**Files:**
- Create: `src/engine/outbox.ts`
- Create: `src/engine/outbox.test.ts`
- Modify: `src/engine/history.ts` (add `pruneHistory(kv, retention)`) and `src/engine/history.test.ts` (one test)
- Create: `src/engine/service.ts` (browser wiring; not unit-tested)
- Modify: `src/main.tsx` (call `startService()` once, before `createRoot`)

**Interfaces:**
- Consumes: Tasks 1, 2, 5, 6.
- Produces (`outbox.ts`): `OUTBOX_KEY`, `OutboxEntry`, `OutboxState`, `loadOutbox`, `enqueue(kv, payload, now) → boolean`, `clearOutbox`, `nextDueAt(kv)`, `backoffMs(attempts)`, `FlushDeps`, `flushOutbox(deps, { atStart? }) → FlushSummary`, `browserLock()`, `backfillCandidates(kv)`, `enqueueBackfill(kv, now) → number`, `enroll(kv, enrollment)`, `unenroll(kv)`.
- Produces (`history.ts`): `pruneHistory(kv, retention)`.
- Produces (`service.ts`): `kv`, `subscribeService`, `getServiceVersion`, `startService`, `flushNow`, `getPrefs`, `setRetention`, `editRecordFlags`, `enrollDevice`, `unenrollDevice`, `sendTestRecord`, `sendBackfill`, `clearAllHistory`.

**Rules:**
- The outbox exists only while enrolled: `enqueue` returns `false` and writes nothing when there is no enrollment; `unenroll` clears it.
- One entry per `recordId`, latest payload wins; if the new payload has no `sbar` and an undelivered one had it, the old `sbar` is kept.
- Backoff after the n-th consecutive failure: `min(300 000, 1000 · 2^(n-1))` ms (1 s → 5 min). The browser `online` event flushes with `ignoreBackoff: true`: after an offline stretch every entry sits in a long backoff, and "a code ended offline is uploaded when the device is online" must not wait it out.
- `rejected` removes the entry, records `lastRejection {error, at}` and marks the record `rejected` — no retries.
- `sent_unconfirmed` keeps the entry flagged `unconfirmed`; it is not re-sent in the same session, and is re-sent exactly once by the next `flushOutbox({ atStart: true })`.
- The entry's key is overridden with the current enrollment key at send time (a re-enrolled device must not send a stale key).
- While a send is in flight, a newer coalesced payload for the same record must survive (compare payload JSON before deleting).
- Flush is serialised across tabs with `navigator.locks` when available (`ifAvailable`); a tab that does not get the lock does nothing.
- Enrolling to a different script URL marks every record `local` again, so backfill offers them all to the new sheet.

- [ ] **Step 1: Write the failing test** — `src/engine/outbox.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { memoryKV, type MemoryKV } from './testing/memoryKV';
import { fakeFetch, html, json } from './testing/fakeFetch';
import { T0, mkRecord } from './testing/fixtures';
import { loadPrefs, savePrefs } from './prefs';
import { loadHistory, upsertRecord } from './history';
import { buildPayload } from './upload';
import {
  OUTBOX_KEY,
  backfillCandidates,
  backoffMs,
  enqueue,
  enqueueBackfill,
  enroll,
  flushOutbox,
  loadOutbox,
  nextDueAt,
  unenroll,
  type FlushDeps,
} from './outbox';

const URL_A = 'https://script.google.com/macros/s/AKfycbxAAAA/exec';
const URL_B = 'https://script.google.com/macros/s/AKfycbxBBBB/exec';
const KEY = 'unit-icu-2026';

function enrolledKV(): MemoryKV {
  const kv = memoryKV();
  savePrefs(kv, { ...loadPrefs(kv), enrollment: { url: URL_A, key: KEY, unit: null } });
  return kv;
}
const pl = (n: number, extra: { sbar?: string } = {}, training = false) =>
  buildPayload(mkRecord(n, { training }), { enrollmentKey: KEY, offsetMin: 0, ...extra });
const queued = (kv: MemoryKV, n: number) => upsertRecord(kv, mkRecord(n, { uploadStatus: 'queued' }));
const mk = (kv: MemoryKV, f: { fetch: typeof fetch }, now = () => T0, over: Partial<FlushDeps> = {}): FlushDeps => ({
  kv,
  now,
  fetch: f.fetch,
  isOnline: () => true,
  ...over,
});
const statusOf = (kv: MemoryKV, n: number) => loadHistory(kv).find((r) => r.id === mkRecord(n).id)?.uploadStatus;

describe('enqueue', () => {
  it('writes nothing while not enrolled', () => {
    const kv = memoryKV();
    expect(enqueue(kv, pl(1), T0)).toBe(false);
    expect(kv.get(OUTBOX_KEY)).toBeNull();
  });

  it('coalesces per record and keeps an undelivered sbar', () => {
    const kv = enrolledKV();
    enqueue(kv, pl(1, { sbar: 'SBAR-1' }), T0);
    enqueue(kv, pl(1, {}, true), T0 + 5); // edit: no sbar
    const e = loadOutbox(kv).entries[mkRecord(1).id];
    expect(Object.keys(loadOutbox(kv).entries)).toHaveLength(1);
    expect(e.payload.training).toBe(true);
    expect(e.payload.sbar).toBe('SBAR-1');
    enqueue(kv, pl(1, { sbar: 'SBAR-2' }), T0 + 9);
    expect(loadOutbox(kv).entries[mkRecord(1).id].payload.sbar).toBe('SBAR-2');
  });
});

describe('flushOutbox', () => {
  it('delivers, removes the entry, marks the record sent, uses the current enrollment key and URL', async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, { ...pl(1), enrollmentKey: 'stale-key-0000' }, T0);
    const f = fakeFetch(json({ ok: true }));
    const s = await flushOutbox(mk(kv, f));
    expect(s.sent).toBe(1);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(URL_A);
    expect(JSON.parse(f.calls[0].init!.body as string).enrollmentKey).toBe(KEY);
    expect(Object.keys(loadOutbox(kv).entries)).toHaveLength(0);
    expect(statusOf(kv, 1)).toBe('sent');
  });

  it('a readable key rejection stops retries and is remembered', async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    const f = fakeFetch(json({ ok: false, error: 'key' }));
    await flushOutbox(mk(kv, f));
    expect(statusOf(kv, 1)).toBe('rejected');
    expect(loadOutbox(kv).lastRejection).toMatchObject({ error: 'key' });
    expect(Object.keys(loadOutbox(kv).entries)).toHaveLength(0);
    await flushOutbox(mk(kv, f, () => T0 + 10 * 60_000));
    expect(f.calls).toHaveLength(1);
  });

  it('retryable failures back off 1 s, 2 s, 4 s … capped at 5 min, and are not retried early', async () => {
    expect([1, 2, 3, 9, 10, 20].map(backoffMs)).toEqual([1000, 2000, 4000, 256_000, 300_000, 300_000]);
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    const f = fakeFetch(html());
    await flushOutbox(mk(kv, f, () => T0));
    expect(statusOf(kv, 1)).toBe('failed');
    expect(nextDueAt(kv)).toBe(T0 + 1000);
    await flushOutbox(mk(kv, f, () => T0 + 500));
    expect(f.calls).toHaveLength(1);
    await flushOutbox(mk(kv, f, () => T0 + 1000));
    expect(f.calls).toHaveLength(2);
    expect(nextDueAt(kv)).toBe(T0 + 1000 + 2000);
  });

  it('no-cors delivery is sent_unconfirmed, not re-sent this session, re-sent once at next start', async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    const f = fakeFetch(new TypeError('cors'), new Response(null), new TypeError('cors'), new Response(null));
    await flushOutbox(mk(kv, f));
    expect(statusOf(kv, 1)).toBe('sent_unconfirmed');
    expect(loadOutbox(kv).entries[mkRecord(1).id].unconfirmed).toBe(true);
    await flushOutbox(mk(kv, f, () => T0 + 60_000)); // same session
    expect(f.calls).toHaveLength(2);
    await flushOutbox(mk(kv, f, () => T0 + 120_000), { atStart: true }); // next app start
    expect(f.calls).toHaveLength(4);
    expect(Object.keys(loadOutbox(kv).entries)).toHaveLength(0);
    expect(statusOf(kv, 1)).toBe('sent_unconfirmed');
  });

  it('a code ended offline is sent as soon as the device is back online, even mid-backoff (ignoreBackoff)', async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    const down = fakeFetch(new TypeError('offline'));
    for (let i = 0; i < 4; i++) {
      const t = T0 + i * 301_000; // each flush is due; every one fails and lengthens the backoff
      await flushOutbox(mk(kv, down, () => t, { isOnline: () => false }));
    }
    expect(down.calls).toHaveLength(4);
    const now = T0 + 3 * 301_000 + 1; // 1 ms after the last failure: still inside its 8 s backoff
    await flushOutbox(mk(kv, down, () => now));
    expect(down.calls).toHaveLength(4); // a normal flush respects the backoff
    const up = fakeFetch(json({ ok: true }));
    const s = await flushOutbox(mk(kv, up, () => now), { ignoreBackoff: true }); // the `online` event
    expect(s.sent).toBe(1);
    expect(statusOf(kv, 1)).toBe('sent');
  });

  it('keeps a newer payload that was coalesced while a send was in flight', async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    const inflight: typeof fetch = async () => {
      enqueue(kv, pl(1, {}, true), T0 + 1);
      return json({ ok: true });
    };
    await flushOutbox(mk(kv, { fetch: inflight }));
    const e = loadOutbox(kv).entries[mkRecord(1).id];
    expect(e?.payload.training).toBe(true);
    expect(statusOf(kv, 1)).toBe('queued');
  });

  it('does nothing when the cross-tab lock is not granted, or when not enrolled', async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    const f = fakeFetch(json({ ok: true }));
    await flushOutbox(mk(kv, f, () => T0, { lock: async () => undefined }));
    expect(f.calls).toHaveLength(0);
    unenroll(kv);
    await flushOutbox(mk(kv, f));
    expect(f.calls).toHaveLength(0);
  });
});

describe('backfill and enrollment', () => {
  it('queues only local records, without sbar, and marks them queued', () => {
    const kv = enrolledKV();
    upsertRecord(kv, mkRecord(1, { uploadStatus: 'local' }));
    upsertRecord(kv, mkRecord(2, { uploadStatus: 'local', training: true }));
    upsertRecord(kv, mkRecord(3, { uploadStatus: 'sent' }));
    expect(backfillCandidates(kv)).toHaveLength(2);
    expect(enqueueBackfill(kv, T0)).toBe(2);
    const entries = Object.values(loadOutbox(kv).entries);
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => !('sbar' in e.payload))).toBe(true);
    expect(statusOf(kv, 1)).toBe('queued');
    expect(statusOf(kv, 3)).toBe('sent');
    expect(backfillCandidates(kv)).toHaveLength(0);
  });

  it('backfill does nothing when not enrolled', () => {
    const kv = memoryKV();
    upsertRecord(kv, mkRecord(1, { uploadStatus: 'local' }));
    expect(enqueueBackfill(kv, T0)).toBe(0);
  });

  it('unenroll clears the outbox and returns unfinished records to local, keeping sent ones', () => {
    const kv = enrolledKV();
    upsertRecord(kv, mkRecord(1, { uploadStatus: 'queued' }));
    upsertRecord(kv, mkRecord(2, { uploadStatus: 'failed' }));
    upsertRecord(kv, mkRecord(3, { uploadStatus: 'sent' }));
    enqueue(kv, pl(1), T0);
    unenroll(kv);
    expect(loadPrefs(kv).enrollment).toBeNull();
    expect(kv.get(OUTBOX_KEY)).toBeNull();
    expect([1, 2, 3].map((n) => statusOf(kv, n))).toEqual(['local', 'local', 'sent']);
  });

  it('enrolling to a different script URL resets every record to local; the same URL does not', () => {
    const kv = enrolledKV();
    upsertRecord(kv, mkRecord(1, { uploadStatus: 'sent' }));
    enroll(kv, { url: URL_A, key: KEY, unit: 'ICU' });
    expect(statusOf(kv, 1)).toBe('sent');
    enroll(kv, { url: URL_B, key: KEY, unit: 'ICU' });
    expect(statusOf(kv, 1)).toBe('local');
    expect(loadPrefs(kv).enrollment?.url).toBe(URL_B);
  });

  it('enrolling clears a previous rejection', async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    await flushOutbox(mk(kv, fakeFetch(json({ ok: false, error: 'key' }))));
    expect(loadOutbox(kv).lastRejection).not.toBeNull();
    enroll(kv, { url: URL_A, key: 'unit-icu-9999', unit: null });
    expect(loadOutbox(kv).lastRejection).toBeNull();
  });
});
```

Add to `src/engine/history.test.ts`:

```ts
import { pruneHistory } from './history'; // add to the existing import list

describe('pruneHistory', () => {
  it('re-applies a tighter retention to what is already stored', () => {
    const kv = memoryKV();
    for (let i = 0; i < 5; i++) upsertRecord(kv, mkRecord(i));
    pruneHistory(kv, { mode: 'last', keep: 3 });
    expect(loadHistory(kv)).toHaveLength(3);
  });
});
```
*(`keep` below 10 is rejected by `loadPrefs`, but `applyRetention` itself accepts any number, which is why the test can use 3.)*

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/engine/outbox.test.ts src/engine/history.test.ts` → FAIL (cannot resolve `./outbox`; `pruneHistory` missing).

- [ ] **Step 3: Implement**

Add to `src/engine/history.ts`:

```ts
/** Re-apply a (possibly tighter) retention to the stored history, e.g. after the setting changes. */
export function pruneHistory(kv: KV, retention: Retention): void {
  persist(kv, loadHistory(kv), retention);
}
```

`src/engine/outbox.ts`:

```ts
/**
 * Upload outbox — one coalesced payload per record, with backoff. Exists ONLY while the device is
 * enrolled: nothing is queued, stored or sent before enrollment. Spec §5.2.
 */
import type { KV } from './kv';
import { loadPrefs, savePrefs, type Enrollment } from './prefs';
import { loadHistory, pruneHistory, updateRecord, type CodeRecord, type UploadStatus } from './history';
import { buildPayload, isRejectError, sendPayload, type RejectError, type SendDeps, type UploadPayload } from './upload';

export const OUTBOX_KEY = 'resuscode.outbox.v1';
const MAX_BACKOFF_MS = 300_000;

export interface OutboxEntry {
  payload: UploadPayload;
  attempts: number;
  nextAttemptAt: number;
  /** delivered via a no-cors request: the reply could not be read, so resend once on next start */
  unconfirmed: boolean;
}
export interface OutboxState {
  entries: Record<string, OutboxEntry>;
  lastRejection: { error: RejectError; at: number } | null;
}

const emptyOutbox = (): OutboxState => ({ entries: {}, lastRejection: null });

export function loadOutbox(kv: KV): OutboxState {
  try {
    const raw = kv.get(OUTBOX_KEY);
    if (!raw) return emptyOutbox();
    const p = JSON.parse(raw) as { entries?: Record<string, Record<string, unknown>>; lastRejection?: Record<string, unknown> | null };
    if (!p || typeof p.entries !== 'object' || p.entries === null) return emptyOutbox();
    const entries: Record<string, OutboxEntry> = {};
    for (const [id, e] of Object.entries(p.entries)) {
      const payload = e?.payload as UploadPayload | undefined;
      if (payload && payload.recordId === id && typeof e.attempts === 'number' && typeof e.nextAttemptAt === 'number') {
        entries[id] = { payload, attempts: e.attempts, nextAttemptAt: e.nextAttemptAt, unconfirmed: !!e.unconfirmed };
      }
    }
    const lr = p.lastRejection;
    const lastRejection = lr && isRejectError(lr.error) && typeof lr.at === 'number' ? { error: lr.error, at: lr.at } : null;
    return { entries, lastRejection };
  } catch {
    return emptyOutbox();
  }
}

function saveOutbox(kv: KV, state: OutboxState): boolean {
  return kv.set(OUTBOX_KEY, JSON.stringify(state));
}

export function clearOutbox(kv: KV): void {
  kv.remove(OUTBOX_KEY);
}

/** Delay after the n-th consecutive failure: 1 s, 2 s, 4 s … capped at 5 min. */
export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempts - 1));
}

export function enqueue(kv: KV, payload: UploadPayload, now: number): boolean {
  if (!loadPrefs(kv).enrollment) return false;
  const state = loadOutbox(kv);
  const old = state.entries[payload.recordId];
  const merged =
    payload.sbar === undefined && old?.payload.sbar !== undefined ? { ...payload, sbar: old.payload.sbar } : payload;
  state.entries[payload.recordId] = { payload: merged, attempts: 0, nextAttemptAt: now, unconfirmed: false };
  return saveOutbox(kv, state);
}

/** Earliest time a retry is due (unconfirmed entries wait for the next app start), or null. */
export function nextDueAt(kv: KV): number | null {
  const due = Object.values(loadOutbox(kv).entries)
    .filter((e) => !e.unconfirmed)
    .map((e) => e.nextAttemptAt);
  return due.length ? Math.min(...due) : null;
}

export interface FlushDeps extends SendDeps {
  kv: KV;
  now: () => number;
  /** Cross-tab mutual exclusion; resolves undefined when the lock is not granted. */
  lock?: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  onChange?: () => void;
}
export interface FlushSummary {
  sent: number;
  rejected: number;
  failed: number;
  unconfirmed: number;
}

export function browserLock(): FlushDeps['lock'] | undefined {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return undefined;
  return <T>(fn: () => Promise<T>) =>
    navigator.locks.request('resuscode-outbox', { ifAvailable: true }, async (lock) => (lock ? fn() : undefined)) as Promise<T | undefined>;
}

export interface FlushOptions {
  /** App start: also re-send entries that were delivered unconfirmed (once). */
  atStart?: boolean;
  /** The `online` event: connectivity just came back, so entries still waiting out an offline backoff are due now. */
  ignoreBackoff?: boolean;
}

export async function flushOutbox(deps: FlushDeps, opts: FlushOptions = {}): Promise<FlushSummary> {
  const summary: FlushSummary = { sent: 0, rejected: 0, failed: 0, unconfirmed: 0 };

  const run = async (): Promise<FlushSummary> => {
    const { kv } = deps;
    const prefs = loadPrefs(kv);
    if (!prefs.enrollment) return summary;
    const setStatus = (id: string, uploadStatus: UploadStatus) => updateRecord(kv, id, { uploadStatus }, prefs.retention);

    const due = Object.values(loadOutbox(kv).entries)
      .filter((e) => (e.unconfirmed ? !!opts.atStart : !!opts.ignoreBackoff || e.nextAttemptAt <= deps.now()))
      .sort((a, b) => a.payload.startEpochMs - b.payload.startEpochMs);

    for (const entry of due) {
      const id = entry.payload.recordId;
      const res = await sendPayload({ ...entry.payload, enrollmentKey: prefs.enrollment.key }, prefs.enrollment.url, deps);

      // Re-read: a newer payload may have been coalesced while the request was in flight.
      const state = loadOutbox(kv);
      const current = state.entries[id];
      if (!current || JSON.stringify(current.payload) !== JSON.stringify(entry.payload)) continue;

      if (res.status === 'sent') {
        delete state.entries[id];
        state.lastRejection = null;
        setStatus(id, 'sent');
        summary.sent += 1;
      } else if (res.status === 'rejected') {
        delete state.entries[id];
        state.lastRejection = { error: res.error, at: deps.now() };
        setStatus(id, 'rejected');
        summary.rejected += 1;
      } else if (res.status === 'sent_unconfirmed') {
        if (entry.unconfirmed) delete state.entries[id]; // its one extra send is done
        else current.unconfirmed = true;
        setStatus(id, 'sent_unconfirmed');
        summary.unconfirmed += 1;
      } else {
        current.attempts += 1;
        current.unconfirmed = false;
        current.nextAttemptAt = deps.now() + backoffMs(current.attempts);
        setStatus(id, 'failed');
        summary.failed += 1;
      }
      saveOutbox(kv, state);
      deps.onChange?.();
    }
    return summary;
  };

  const out = deps.lock ? await deps.lock(run) : await run();
  return out ?? summary;
}

export function backfillCandidates(kv: KV): CodeRecord[] {
  return loadHistory(kv).filter((r) => r.uploadStatus === 'local');
}

/** Queue every earlier (local) record, statistics only (no sbar). Returns how many were queued. */
export function enqueueBackfill(kv: KV, now: number): number {
  const prefs = loadPrefs(kv);
  if (!prefs.enrollment) return 0;
  let n = 0;
  for (const r of backfillCandidates(kv)) {
    if (enqueue(kv, buildPayload(r, { enrollmentKey: prefs.enrollment.key }), now)) {
      updateRecord(kv, r.id, { uploadStatus: 'queued' }, prefs.retention);
      n += 1;
    }
  }
  return n;
}

export function enroll(kv: KV, enrollment: Enrollment): void {
  const prefs = loadPrefs(kv);
  const newDestination = prefs.enrollment?.url !== enrollment.url;
  savePrefs(kv, { ...prefs, enrollment });
  const state = loadOutbox(kv);
  state.lastRejection = null;
  if (newDestination) state.entries = {}; // payloads built for the old sheet must not leak into the new one
  saveOutbox(kv, state);
  if (newDestination) {
    for (const r of loadHistory(kv)) if (r.uploadStatus !== 'local') updateRecord(kv, r.id, { uploadStatus: 'local' }, prefs.retention);
  }
}

export function unenroll(kv: KV): void {
  const prefs = loadPrefs(kv);
  savePrefs(kv, { ...prefs, enrollment: null });
  clearOutbox(kv);
  for (const r of loadHistory(kv)) {
    if (r.uploadStatus === 'queued' || r.uploadStatus === 'failed' || r.uploadStatus === 'rejected') {
      updateRecord(kv, r.id, { uploadStatus: 'local' }, prefs.retention);
    }
  }
  pruneHistory(kv, prefs.retention);
}
```

`src/engine/service.ts` (browser wiring; verified in Task 13, not unit-tested):

```ts
/**
 * Browser wiring for history + upload: installs the capture observer, flushes the outbox
 * (app start, `online`, after a record, backoff timer) and exposes the actions the UI calls.
 * Engine modules stay pure; this file is the only place that touches `window`, `fetch` and the store.
 */
import { useCodeStore } from './store';
import { browserKV, type KV } from './kv';
import { clearHistory, pruneHistory, updateRecord } from './history';
import { installHistoryCapture } from './historyCapture';
import { loadPrefs, savePrefs, type Enrollment, type Prefs, type Retention } from './prefs';
import {
  backfillCandidates,
  browserLock,
  clearOutbox,
  enqueue,
  enqueueBackfill,
  enroll,
  flushOutbox,
  nextDueAt,
  unenroll,
  type FlushDeps,
  type FlushOptions,
} from './outbox';
import { buildPayload, buildTestPayload, sendPayload, type SendResult } from './upload';

export const kv: KV | null = browserKV();

// A tiny change signal so React can re-read storage (history, outbox, prefs) after any write.
const listeners = new Set<() => void>();
let version = 0;
export const getServiceVersion = (): number => version;
export function subscribeService(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function notify(): void {
  version += 1;
  listeners.forEach((fn) => fn());
}

const sendDeps = () => ({
  fetch: ((input: RequestInfo | URL, init?: RequestInit) => window.fetch(input, init)) as typeof fetch,
  isOnline: () => navigator.onLine,
});

let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function scheduleNext(): void {
  if (!kv) return;
  if (timer != null) clearTimeout(timer);
  timer = null;
  const due = nextDueAt(kv);
  if (due != null) timer = setTimeout(() => void flushNow(), Math.max(1000, due - Date.now()));
}

export async function flushNow(opts: FlushOptions = {}): Promise<void> {
  if (!kv || flushing) return;
  flushing = true;
  try {
    const deps: FlushDeps = { kv, now: Date.now, ...sendDeps(), lock: browserLock(), onChange: notify };
    await flushOutbox(deps, opts);
  } catch (e) {
    console.error('[upload] flush failed', e);
  } finally {
    flushing = false;
    notify();
    scheduleNext();
  }
}

export function startService(): void {
  if (!kv || typeof window === 'undefined') return;
  const store = kv;
  installHistoryCapture(useCodeStore, {
    kv: store,
    now: Date.now,
    onChanged: notify,
    onRecorded: (rec, sbar) => {
      const prefs = loadPrefs(store);
      if (!prefs.enrollment) return;
      enqueue(store, buildPayload(rec, { enrollmentKey: prefs.enrollment.key, sbar }), Date.now());
      notify();
      void flushNow();
    },
  });
  // After an offline stretch every entry is sitting in a long backoff; coming back online must not wait it out.
  window.addEventListener('online', () => void flushNow({ ignoreBackoff: true }));
  window.addEventListener('storage', notify); // another tab changed history / outbox / prefs
  void flushNow({ atStart: true });
}

export const getPrefs = (): Prefs => loadPrefs(kv);

export function setRetention(retention: Retention): void {
  if (!kv) return;
  savePrefs(kv, { ...loadPrefs(kv), retention });
  pruneHistory(kv, retention);
  notify();
}

/** Edit a history record's flags; an enrolled device re-uploads the change (statistics only, no sbar). */
export function editRecordFlags(id: string, patch: { training?: boolean; voided?: boolean }): void {
  if (!kv) return;
  const prefs = loadPrefs(kv);
  const rec = updateRecord(kv, id, { ...patch, uploadStatus: prefs.enrollment ? 'queued' : 'local' }, prefs.retention);
  if (rec && prefs.enrollment) {
    enqueue(kv, buildPayload(rec, { enrollmentKey: prefs.enrollment.key }), Date.now());
    void flushNow();
  }
  notify();
}

export function enrollDevice(e: Enrollment): void {
  if (!kv) return;
  enroll(kv, e);
  notify();
}

export function unenrollDevice(): void {
  if (!kv) return;
  unenroll(kv);
  notify();
}

/** Settings → "Send test record": one immediate attempt, result shown inline, never queued. */
export async function sendTestRecord(): Promise<SendResult | 'not_enrolled'> {
  if (!kv) return 'not_enrolled';
  const prefs = loadPrefs(kv);
  if (!prefs.enrollment) return 'not_enrolled';
  return sendPayload(buildTestPayload(prefs.deviceId, prefs.enrollment.key, Date.now()), prefs.enrollment.url, sendDeps());
}

export const backfillCount = (): number => (kv ? backfillCandidates(kv).length : 0);

export function sendBackfill(): number {
  if (!kv) return 0;
  const n = enqueueBackfill(kv, Date.now());
  notify();
  void flushNow();
  return n;
}

export function clearAllHistory(): void {
  if (!kv) return;
  clearHistory(kv);
  clearOutbox(kv);
  notify();
}
```

In `src/main.tsx`, import and call before rendering:

```ts
import { startService } from './engine/service';
// …after the service-worker block, before createRoot:
startService();
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/outbox.test.ts src/engine/history.test.ts && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit** — `git add src/engine/outbox.ts src/engine/outbox.test.ts src/engine/history.ts src/engine/history.test.ts src/engine/service.ts src/main.tsx && git commit -m "feat: upload outbox, backfill, enrollment state and service wiring"`

---

### Task 8: Sheet logic (`src/admin/sheetCore.js` + `.d.ts`)

**Files:**
- Create: `src/admin/sheetCore.js`
- Create: `src/admin/sheetCore.d.ts`
- Create: `src/admin/sheetCore.test.ts`

**Interfaces:**
- Produces: `PAYLOAD_VERSION`, `MAX_BODY_CHARS`, `MAX_CELL_CHARS`, `RECORD_ID_RE`, `DEVICE_ID_RE`, `DEVICE_COLUMNS`, `ADMIN_COLUMNS`, `ISSUE_CATEGORIES`, `ACTION_STATUSES`, `neutralise(v)`, `validatePayload(p) → 'version'|'schema'|null`, `findActiveUnit(units, key) → {name}|null`, `flattenPayload(p, unitName, nowIso)`, `handleUpload(body, sheet, nowMs) → {ok:true} | {ok:false,error}`.
- `SheetAdapter` (injected; implemented in `wrapper.gs` for Apps Script, in memory for tests): `readHeaders()`, `addHeaders(names)`, `findRow(header, value) → 1-based sheet row | null`, `appendRow(cells)`, `updateCells(row, cells)`, `readUnits() → [{key, unit, active}]`.

**Constraints that make this file safe to paste into Apps Script:** plain ES2019 JavaScript, only top-level `export function` / `export const` declarations (the build strips the `export` keyword), no imports, no `window`/Node APIs, no reference to Apps Script globals (those live in `wrapper.gs`).

**Rules (spec §5.2):** reject > 100 000 chars (`size`), unknown `payloadVersion` (`version`), schema errors and bad `recordId` (`schema`), unknown / inactive key (`key`); map columns by header name; append missing device headers, never reorder; write only device-owned fields present in the payload; never write admin-owned columns; neutralise `= + - @ \t \r`; truncate strings to 50 000; respond only `{ok}`. The lock is held by the caller (`wrapper.gs`).

- [ ] **Step 1: Write the type declarations** — `src/admin/sheetCore.d.ts`

```ts
export type RejectCode = 'size' | 'version' | 'schema' | 'key';
export type UploadResult = { ok: true } | { ok: false; error: RejectCode };

export interface UnitRow {
  key: unknown;
  unit: unknown;
  /** boolean true or the string "TRUE" (case-insensitive) means active */
  active: unknown;
}

export interface SheetAdapter {
  readHeaders(): string[];
  addHeaders(names: string[]): void;
  /** 1-based sheet row number of the first data row whose `header` cell equals `value`, or null */
  findRow(header: string, value: string): number | null;
  appendRow(cells: Record<string, unknown>): void;
  updateCells(row: number, cells: Record<string, unknown>): void;
  readUnits(): UnitRow[];
}

export const PAYLOAD_VERSION: 1;
export const MAX_BODY_CHARS: number;
export const MAX_CELL_CHARS: number;
export const RECORD_ID_RE: RegExp;
export const DEVICE_ID_RE: RegExp;
export const DEVICE_COLUMNS: string[];
export const ADMIN_COLUMNS: string[];
export const ISSUE_CATEGORIES: string[];
export const ACTION_STATUSES: string[];

export function neutralise<T>(v: T): T | string;
export function validatePayload(p: unknown): 'version' | 'schema' | null;
export function findActiveUnit(units: UnitRow[], key: string): { name: string } | null;
export function flattenPayload(p: Record<string, any>, unitName: string, nowIso: string): Record<string, unknown>;
export function handleUpload(body: string, sheet: SheetAdapter, nowMs: number): UploadResult;
```

- [ ] **Step 2: Write the failing test** — `src/admin/sheetCore.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildPayload, buildTestPayload } from '../engine/upload';
import { DEVICE, T0, mkRecord } from '../engine/testing/fixtures';
import {
  ADMIN_COLUMNS,
  DEVICE_COLUMNS,
  MAX_CELL_CHARS,
  handleUpload,
  neutralise,
  type SheetAdapter,
  type UnitRow,
} from './sheetCore.js';

const KEY = 'unit-icu-2026';
const UNITS: UnitRow[] = [
  { key: KEY, unit: 'ICU', active: true },
  { key: 'unit-ward-2026', unit: 'Ward 7', active: 'TRUE' },
  { key: 'unit-old-2026', unit: 'Retired', active: false },
  { key: 'unit-old2-2026', unit: 'Retired2', active: 'FALSE' },
];

type Row = Record<string, unknown>;
function memorySheet(headers: string[] = [], rows: Row[] = [], units: UnitRow[] = UNITS) {
  const sheet: SheetAdapter & { headers: string[]; rows: Row[] } = {
    headers,
    rows,
    readHeaders: () => [...headers],
    addHeaders: (names) => {
      headers.push(...names);
    },
    findRow: (h, v) => {
      if (!headers.includes(h)) return null;
      const i = rows.findIndex((r) => String(r[h]) === v);
      return i < 0 ? null : i + 2;
    },
    appendRow: (cells) => {
      const r: Row = {};
      for (const h of headers) r[h] = h in cells ? cells[h] : '';
      rows.push(r);
    },
    updateCells: (row, cells) => {
      for (const [k, v] of Object.entries(cells)) if (headers.includes(k)) rows[row - 2][k] = v;
    },
    readUnits: () => units,
  };
  return sheet;
}

const P = (over: Record<string, unknown> = {}) => ({
  ...buildPayload(mkRecord(1), { enrollmentKey: KEY, offsetMin: 0 }),
  ...over,
});
const send = (sheet: SheetAdapter, p: unknown, now = T0) => handleUpload(typeof p === 'string' ? p : JSON.stringify(p), sheet, now);

describe('insert / find-or-insert', () => {
  it('inserts one row mapped by header name, with the unit taken from the Units tab', () => {
    const s = memorySheet();
    expect(send(s, P())).toEqual({ ok: true });
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({
      record_id: mkRecord(1).id,
      device_id: DEVICE,
      unit: 'ICU',
      outcome: 'rosc',
      training: false,
      void: false,
      arrest_ms: 600_000,
      start_month: '2023-11',
      rhythms: 'VF; VF; PEA',
      shock_joules: '200 200',
      payload_version: 1,
    });
    expect(s.headers).not.toContain('sbar'); // absent in the payload → no column, no cell
  });

  it('two uploads of one record produce one row (two tabs, retries)', () => {
    const s = memorySheet();
    send(s, P());
    send(s, P());
    expect(s.rows).toHaveLength(1);
  });

  it('only device headers are ever added; the order of existing headers is never changed', () => {
    const s = memorySheet(['debrief_note', 'record_id']);
    send(s, P());
    expect(s.headers.slice(0, 2)).toEqual(['debrief_note', 'record_id']);
    expect(s.headers.slice(2).every((h) => DEVICE_COLUMNS.includes(h))).toBe(true);
    expect(s.headers.every((h) => !ADMIN_COLUMNS.includes(h) || h === 'debrief_note')).toBe(true);
  });
});

describe('admin columns and absent fields', () => {
  it('admin-owned cells survive every re-upload', () => {
    const id = mkRecord(1).id;
    const s = memorySheet(['debrief_note', 'reviewed', 'record_id'], [{ debrief_note: 'Good CPR', reviewed: true, record_id: id }]);
    send(s, P());
    send(s, P({ training: true }), T0 + 5000);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].debrief_note).toBe('Good CPR');
    expect(s.rows[0].reviewed).toBe(true);
  });

  it('toggling training changes only `training` and `last_upload_iso`; the SBAR cell keeps its value', () => {
    const s = memorySheet();
    send(s, P({ sbar: 'SBAR-1' }), T0);
    const before = { ...s.rows[0] };
    send(s, P({ training: true }), T0 + 60_000); // edit: no sbar
    const after = s.rows[0];
    const changed = Object.keys(after).filter((k) => after[k] !== before[k]).sort();
    expect(changed).toEqual(['last_upload_iso', 'training']);
    expect(after.sbar).toBe('SBAR-1');
  });

  it('a payload never writes admin-owned columns even if the sheet has them', () => {
    const s = memorySheet(['record_id', 'debrief_note', 'exclude']);
    send(s, P());
    expect(s.rows[0].debrief_note).toBe('');
    expect(s.rows[0].exclude).toBe('');
  });
});

describe('rejections (nothing is written)', () => {
  const cases: Array<[string, unknown, string]> = [
    ['oversized body', 'x'.repeat(100_001), 'size'],
    ['not JSON', '{nope', 'schema'],
    ['JSON array', '[]', 'schema'],
    ['future payloadVersion', P({ payloadVersion: 2 }), 'version'],
    ['missing payloadVersion', (() => { const p: Record<string, unknown> = P(); delete p.payloadVersion; return p; })(), 'version'],
    ['bad training type', P({ training: 'yes' }), 'schema'],
    ['missing stats', P({ stats: undefined }), 'schema'],
    ['bad outcome', P({ stats: { ...mkRecord(1).stats, outcome: 'maybe' } }), 'schema'],
    ['bad recordId format', P({ recordId: 'nope' }), 'schema'],
    ['recordId not ending in the deviceId', P({ recordId: `${T0}-ffffffffffff` }), 'schema'],
    ['unknown key', P({ enrollmentKey: 'unknown-key-0000' }), 'key'],
    ['inactive unit (boolean)', P({ enrollmentKey: 'unit-old-2026' }), 'key'],
    ['inactive unit (string FALSE)', P({ enrollmentKey: 'unit-old2-2026' }), 'key'],
  ];
  it.each(cases)('%s → %s', (_n, body, error) => {
    const s = memorySheet();
    expect(send(s, body)).toEqual({ ok: false, error });
    expect(s.rows).toHaveLength(0);
    expect(s.headers).toHaveLength(0);
  });

  it('accepts a unit whose active flag is the string TRUE', () => {
    const s = memorySheet();
    expect(send(s, P({ enrollmentKey: 'unit-ward-2026' }))).toEqual({ ok: true });
    expect(s.rows[0].unit).toBe('Ward 7');
  });
});

describe('safety', () => {
  it('neutralises formula starters', () => {
    expect(neutralise('=1+1')).toBe("'=1+1");
    expect(neutralise('+x')).toBe("'+x");
    expect(neutralise('-x')).toBe("'-x");
    expect(neutralise('@x')).toBe("'@x");
    expect(neutralise('\tx')).toBe("'\tx");
    expect(neutralise('plain')).toBe('plain');
    expect(neutralise(-5)).toBe(-5);
    expect(neutralise(true)).toBe(true);
  });

  it('writes a hostile SBAR and unit name as text', () => {
    const s = memorySheet([], [], [{ key: KEY, unit: '+evil', active: true }]);
    send(s, P({ sbar: '=HYPERLINK("http://x","y")' }));
    expect(String(s.rows[0].sbar).startsWith("'=HYPERLINK")).toBe(true);
    expect(s.rows[0].unit).toBe("'+evil");
  });

  it('truncates long strings to the cell limit', () => {
    const s = memorySheet();
    send(s, P({ sbar: 'a'.repeat(60_000) }));
    expect(String(s.rows[0].sbar)).toHaveLength(MAX_CELL_CHARS);
  });

  it('responds with nothing but ok', () => {
    const s = memorySheet();
    expect(Object.keys(send(s, P()))).toEqual(['ok']);
  });

  it('accepts the Send-test-record payload as a training TEST row', () => {
    const s = memorySheet();
    expect(send(s, buildTestPayload(DEVICE, KEY, T0, 0))).toEqual({ ok: true });
    expect(s.rows[0]).toMatchObject({ record_id: `TEST-${DEVICE}`, training: true, unit: 'ICU' });
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `npx vitest run src/admin/sheetCore.test.ts` → FAIL (cannot resolve `./sheetCore.js`).

- [ ] **Step 4: Implement** — `src/admin/sheetCore.js`

```js
/**
 * Admin sheet logic: validate an upload and write it to the Codes sheet.
 * Pure — it talks to the sheet only through the injected `sheet` adapter, so it is unit-tested in Node
 * and pasted unchanged into Apps Script (scripts/build-apps-script.mjs strips the `export` keywords).
 * Keep to plain ES2019, top-level `export function` / `export const` only, no imports.
 * Spec: docs/superpowers/specs/2026-10-16-stats-admin-i18n-design.md §5.2.
 */

export const PAYLOAD_VERSION = 1;
export const MAX_BODY_CHARS = 100000;
export const MAX_CELL_CHARS = 50000;
export const RECORD_ID_RE = /^(?:[0-9]{12,14}|TEST)-[0-9a-f]{8,32}$/;
export const DEVICE_ID_RE = /^[0-9a-f]{8,32}$/;

const OUTCOMES = ['rosc', 'rosc_then_terminated', 'terminated', 'incomplete'];

/** Written by the script (device-owned). */
export const DEVICE_COLUMNS = [
  'record_id', 'unit', 'device_id', 'start_iso', 'start_month', 'start_epoch_ms', 'outcome', 'training', 'void',
  'ended_epoch_ms', 'arrest_ms', 'rosc_count', 'first_rosc_ms', 'first_shock_ms', 'first_epi_ms',
  'branch_at_first_epi', 'shock_count', 'shock_joules', 'epi_count', 'epi_mean_interval_ms',
  'epi_longest_interval_ms', 'epi_interval_flag', 'amiodarone_count', 'amiodarone_mg', 'lidocaine_count',
  'magnesium_count', 'cycles', 'paused_ms', 'airway_type', 'airway_first_ms', 'rhythms', 'causes', 'pocus',
  'post_rosc_done', 'post_rosc_total', 'sbar', 'payload_version', 'stats_version', 'last_upload_iso',
];

/** Written only by the admin; the script never touches them. */
export const ADMIN_COLUMNS = [
  'debrief_note', 'issue_category', 'action_status', 'reviewed', 'reviewer', 'review_date', 'exclude', 'duplicate_of',
];

export const ISSUE_CATEGORIES = [
  'CPR quality', 'drug timing', 'airway', 'defibrillation', 'communication', 'equipment', 'other',
];
export const ACTION_STATUSES = ['none', 'open', 'done'];

function isObj(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Truncate to the Sheets cell limit and defuse formula starters (= + - @ tab CR). Non-strings pass through. */
export function neutralise(v) {
  if (typeof v !== 'string') return v;
  let s = v.length > MAX_CELL_CHARS ? v.slice(0, MAX_CELL_CHARS) : v;
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s.length > MAX_CELL_CHARS ? s.slice(0, MAX_CELL_CHARS) : s;
}

/** Returns 'version' | 'schema' | null (valid). The enrollment key is checked separately. */
export function validatePayload(p) {
  if (!isObj(p)) return 'schema';
  if (p.payloadVersion !== PAYLOAD_VERSION) return 'version';
  if (typeof p.enrollmentKey !== 'string' || p.enrollmentKey.length < 1 || p.enrollmentKey.length > 64) return 'schema';
  if (typeof p.recordId !== 'string' || !RECORD_ID_RE.test(p.recordId)) return 'schema';
  if (typeof p.deviceId !== 'string' || !DEVICE_ID_RE.test(p.deviceId)) return 'schema';
  if (p.recordId.slice(-(p.deviceId.length + 1)) !== '-' + p.deviceId) return 'schema';
  if (typeof p.startEpochMs !== 'number' || !isFinite(p.startEpochMs)) return 'schema';
  if (typeof p.startIso !== 'string' || p.startIso.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(p.startIso)) return 'schema';
  if (typeof p.training !== 'boolean' || typeof p.voided !== 'boolean') return 'schema';
  if (p.sbar !== undefined && typeof p.sbar !== 'string') return 'schema';
  const st = p.stats;
  if (!isObj(st) || typeof st.statsVersion !== 'number' || OUTCOMES.indexOf(st.outcome) < 0 || typeof st.arrestMs !== 'number') {
    return 'schema';
  }
  return null;
}

/** An unrevoked unit row for `key`, or null (unknown key, or the row has active = FALSE). */
export function findActiveUnit(units, key) {
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const k = String(u.key == null ? '' : u.key).trim();
    if (k === '' || k !== key) continue;
    const a = u.active;
    if (a === true || (typeof a === 'string' && a.trim().toUpperCase() === 'TRUE')) {
      return { name: String(u.unit == null ? '' : u.unit) };
    }
    return null;
  }
  return null;
}

function val(v) {
  return v === undefined || v === null ? null : v;
}
function joinList(a, sep) {
  return Array.isArray(a) ? a.map(String).join(sep) : null;
}

/** Device-owned cell values for one payload. A key is present only when the payload carries it (sbar). */
export function flattenPayload(p, unitName, nowIso) {
  const st = p.stats;
  const out = {
    record_id: p.recordId,
    unit: unitName,
    device_id: p.deviceId,
    start_iso: p.startIso,
    start_month: p.startIso.slice(0, 7),
    start_epoch_ms: p.startEpochMs,
    outcome: st.outcome,
    training: p.training,
    void: p.voided,
    ended_epoch_ms: val(st.endedAt),
    arrest_ms: val(st.arrestMs),
    rosc_count: val(st.roscCount),
    first_rosc_ms: val(st.firstRoscMs),
    first_shock_ms: val(st.firstShockMs),
    first_epi_ms: val(st.firstEpiMs),
    branch_at_first_epi: val(st.branchAtFirstEpi),
    shock_count: val(st.shocks && st.shocks.count),
    shock_joules: joinList(st.shocks && st.shocks.joules, ' '),
    epi_count: val(st.epi && st.epi.count),
    epi_mean_interval_ms: val(st.epi && st.epi.meanIntervalMs),
    epi_longest_interval_ms: val(st.epi && st.epi.longestIntervalMs),
    epi_interval_flag: val(st.epi && st.epi.longestExceedsThreshold),
    amiodarone_count: val(st.amiodarone && st.amiodarone.count),
    amiodarone_mg: val(st.amiodarone && st.amiodarone.totalMg),
    lidocaine_count: val(st.lidocaine && st.lidocaine.count),
    magnesium_count: val(st.magnesium && st.magnesium.count),
    cycles: val(st.cycles),
    paused_ms: val(st.pausedMs),
    airway_type: val(st.airway && st.airway.type),
    airway_first_ms: val(st.airway && st.airway.firstPlacedMs),
    rhythms: joinList(st.rhythms, '; '),
    causes: joinList(st.causes, '; '),
    pocus: joinList(st.pocus, '; '),
    post_rosc_done: val(st.postRosc && st.postRosc.done),
    post_rosc_total: val(st.postRosc && st.postRosc.total),
    payload_version: p.payloadVersion,
    stats_version: val(st.statsVersion),
    last_upload_iso: nowIso,
  };
  if (typeof p.sbar === 'string') out.sbar = p.sbar;
  return out;
}

/**
 * Validate and apply one upload. The caller (doPost) holds the script lock around this call.
 * Never returns sheet data: only { ok: true } or { ok: false, error }.
 */
export function handleUpload(body, sheet, nowMs) {
  if (typeof body !== 'string' || body.length > MAX_BODY_CHARS) return { ok: false, error: 'size' };
  let p;
  try {
    p = JSON.parse(body);
  } catch (e) {
    return { ok: false, error: 'schema' };
  }
  const bad = validatePayload(p);
  if (bad) return { ok: false, error: bad };
  const unit = findActiveUnit(sheet.readUnits(), p.enrollmentKey);
  if (!unit) return { ok: false, error: 'key' };

  const values = flattenPayload(p, unit.name, new Date(nowMs).toISOString());
  const wanted = Object.keys(values);
  const headers = sheet.readHeaders();
  const missing = wanted.filter(function (c) {
    return headers.indexOf(c) < 0;
  });
  if (missing.length) sheet.addHeaders(missing);

  const cells = {};
  for (let i = 0; i < wanted.length; i++) cells[wanted[i]] = neutralise(values[wanted[i]]);

  const row = sheet.findRow('record_id', p.recordId);
  if (row == null) sheet.appendRow(cells);
  else sheet.updateCells(row, cells);
  return { ok: true };
}
```

- [ ] **Step 5: Run to verify it passes** — `npx vitest run src/admin/sheetCore.test.ts && npm run typecheck && npm test` → PASS. (The test imports the real client `buildPayload`/`mkRecord`, so a client/server contract drift fails here.)

- [ ] **Step 6: Commit** — `git add src/admin && git commit -m "feat: sheetCore - validated find-or-insert upload logic for the admin sheet"`

---

### Task 9: Apps Script build (`wrapper.gs`, `build-apps-script.mjs`, `Code.gs`)

**Files:**
- Create: `admin/apps-script/wrapper.gs` (hand-written Apps Script glue + one-time sheet setup)
- Create: `admin/apps-script/appsscript.json` (manifest: V8, web app runs as the deployer, anyone can call it)
- Create: `scripts/build-apps-script.mjs` and `scripts/build-apps-script.d.mts`
- Create (generated, committed): `admin/apps-script/Code.gs`
- Create: `src/admin/build.test.ts`
- Modify: `package.json` (add the `build:apps-script` script only)

**Interfaces:**
- Produces: `buildCode(base?) → string` (header + `sheetCore.js` without `export` + `wrapper.gs`), `main()`; `npm run build:apps-script` writes `admin/apps-script/Code.gs`.

**Why the adapter looks the way it does (trap to avoid):** the admin columns carry pre-inserted checkboxes (value `FALSE`) down to row 5001. `Sheet.appendRow` / `getLastRow()` would therefore append *below* row 5001. The adapter finds the next free row from the `record_id` column instead, and writes a new row by reading the existing cell values and overwriting only the device-owned cells, so admin cells (and their checkboxes) are untouched.

- [ ] **Step 1: Write the failing test** — `src/admin/build.test.ts`

```ts
/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildCode } from '../../scripts/build-apps-script.mjs';

const norm = (s: string) => s.replace(/\r\n/g, '\n');

describe('apps script build', () => {
  const built = buildCode();

  it('the committed Code.gs matches a fresh build (run `npm run build:apps-script`)', () => {
    expect(norm(readFileSync('admin/apps-script/Code.gs', 'utf8'))).toBe(norm(built));
  });

  it('has no ES module syntax and defines the Apps Script entry points', () => {
    expect(built).not.toMatch(/^\s*(export|import)\s/m);
    for (const fn of ['doGet', 'doPost', 'setupAdminSheet', 'handleUpload']) expect(built).toContain(`function ${fn}(`);
  });

  it('evaluates as plain script and the stripped core still works', () => {
    const api = new Function(`${built}\nreturn { handleUpload, DEVICE_COLUMNS };`)() as {
      handleUpload: (body: string, sheet: unknown, now: number) => unknown;
      DEVICE_COLUMNS: string[];
    };
    expect(api.handleUpload('{nope', {}, 0)).toEqual({ ok: false, error: 'schema' });
    expect(api.DEVICE_COLUMNS).toContain('record_id');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/admin/build.test.ts` → FAIL (cannot resolve the build script).

- [ ] **Step 3: Implement**

`scripts/build-apps-script.mjs`:

```js
// Builds admin/apps-script/Code.gs = sheetCore.js (export keywords stripped) + wrapper.gs.
// Apps Script cannot load ES modules, so the pure logic is concatenated into one script file.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);
const root = resolve(dirname(here), '..');

const HEADER =
  '// GENERATED by scripts/build-apps-script.mjs — do not edit.\n' +
  '// Sources: src/admin/sheetCore.js + admin/apps-script/wrapper.gs. Rebuild with `npm run build:apps-script`.\n';

const read = (base, rel) => readFileSync(resolve(base, rel), 'utf8').replace(/\r\n/g, '\n');

export function buildCode(base = root) {
  const core = read(base, 'src/admin/sheetCore.js').replace(/^export\s+/gm, '');
  const wrapper = read(base, 'admin/apps-script/wrapper.gs');
  return `${HEADER}\n${core.trimEnd()}\n\n${wrapper.trimEnd()}\n`;
}

export function main() {
  const out = resolve(root, 'admin/apps-script/Code.gs');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildCode());
  console.log(`wrote ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === here) main();
```

`scripts/build-apps-script.d.mts`:

```ts
export function buildCode(base?: string): string;
export function main(): void;
```

`admin/apps-script/appsscript.json`:

```json
{
  "timeZone": "UTC",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }
}
```

`admin/apps-script/wrapper.gs`:

```js
// ---------------------------------------------------------------------------
// Apps Script glue. Container-bound: create the script from the admin's Google Sheet
// (Extensions → Apps Script), so SpreadsheetApp.getActiveSpreadsheet() is the sheet.
// Everything above this line is src/admin/sheetCore.js (pure, unit-tested).
// ---------------------------------------------------------------------------

const CODES_SHEET = 'Codes';
const UNITS_SHEET = 'Units';
const DASH_SHEET = 'Dashboard';
const CHECKBOX_ROWS = 5000; // pre-formatted data rows on the Codes sheet

/** Opening the web-app URL in a browser answers "ok" (a quick deployment check). */
function doGet() {
  return ContentService.createTextOutput('ok');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let result;
  if (!lock.tryLock(25000)) {
    result = { ok: false, error: 'busy' };
  } else {
    try {
      const body = e && e.postData ? e.postData.contents : '';
      result = handleUpload(body, makeAdapter_(SpreadsheetApp.getActiveSpreadsheet()), Date.now());
    } catch (err) {
      console.error(err);
      result = { ok: false, error: 'server' };
    } finally {
      lock.releaseLock();
    }
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function makeAdapter_(ss) {
  const codes = ss.getSheetByName(CODES_SHEET) || ss.insertSheet(CODES_SHEET);
  const units = ss.getSheetByName(UNITS_SHEET);

  function headers_() {
    const n = codes.getLastColumn();
    return n === 0 ? [] : codes.getRange(1, 1, 1, n).getValues()[0].map(String);
  }

  // Not getLastRow(): pre-inserted admin checkboxes make every row "used".
  function nextFreeRow_(h) {
    const c = h.indexOf('record_id') + 1;
    if (!c) return 2;
    const n = Math.max(1, codes.getMaxRows() - 1);
    const vals = codes.getRange(2, c, n, 1).getValues();
    for (let i = vals.length - 1; i >= 0; i--) if (vals[i][0] !== '') return i + 3;
    return 2;
  }

  return {
    readHeaders: headers_,
    addHeaders: function (names) {
      codes.getRange(1, headers_().length + 1, 1, names.length).setValues([names]);
    },
    findRow: function (name, value) {
      const c = headers_().indexOf(name) + 1;
      if (!c) return null;
      const n = Math.max(1, codes.getMaxRows() - 1);
      const vals = codes.getRange(2, c, n, 1).getValues();
      for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === value) return i + 2;
      return null;
    },
    appendRow: function (cells) {
      const h = headers_();
      const row = nextFreeRow_(h);
      if (row > codes.getMaxRows()) codes.insertRowsAfter(codes.getMaxRows(), 100);
      const range = codes.getRange(row, 1, 1, h.length);
      const current = range.getValues()[0];
      range.setValues([
        h.map(function (n, i) {
          return Object.prototype.hasOwnProperty.call(cells, n) ? cells[n] : current[i]; // admin cells keep their value
        }),
      ]);
    },
    updateCells: function (row, cells) {
      const h = headers_();
      Object.keys(cells).forEach(function (n) {
        const c = h.indexOf(n) + 1;
        if (c) codes.getRange(row, c).setValue(cells[n]);
      });
    },
    readUnits: function () {
      if (!units || units.getLastRow() < 2) return [];
      const v = units.getDataRange().getValues();
      const hd = v[0].map(String);
      const k = hd.indexOf('enrollment_key');
      const u = hd.indexOf('unit_name');
      const a = hd.indexOf('active');
      return v.slice(1).map(function (r) {
        return { key: k < 0 ? '' : r[k], unit: u < 0 ? '' : r[u], active: a < 0 ? false : r[a] };
      });
    },
  };
}

function letter_(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Run once from the editor (Run → setupAdminSheet): creates the Codes / Units / Dashboard tabs,
 * headers, dropdowns, checkboxes and the Dashboard formulas. Safe to re-run: it never clears data.
 */
function setupAdminSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const codes = ss.getSheetByName(CODES_SHEET) || ss.insertSheet(CODES_SHEET);
  const units = ss.getSheetByName(UNITS_SHEET) || ss.insertSheet(UNITS_SHEET);
  const dash = ss.getSheetByName(DASH_SHEET) || ss.insertSheet(DASH_SHEET);
  const last = CHECKBOX_ROWS + 1;

  // --- Codes ---
  const all = DEVICE_COLUMNS.concat(ADMIN_COLUMNS);
  if (codes.getLastColumn() === 0) codes.getRange(1, 1, 1, all.length).setValues([all]);
  codes.setFrozenRows(1);
  if (codes.getMaxRows() < last) codes.insertRowsAfter(codes.getMaxRows(), last - codes.getMaxRows());
  const header = codes.getRange(1, 1, 1, codes.getLastColumn()).getValues()[0].map(String);
  const col = function (name) {
    return header.indexOf(name) + 1;
  };
  ['record_id', 'device_id', 'start_iso', 'start_month'].forEach(function (n) {
    if (col(n)) codes.getRange(2, col(n), CHECKBOX_ROWS, 1).setNumberFormat('@'); // keep as text: no date parsing
  });
  const list = function (values) {
    return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  };
  if (col('issue_category')) codes.getRange(2, col('issue_category'), CHECKBOX_ROWS, 1).setDataValidation(list(ISSUE_CATEGORIES));
  if (col('action_status')) codes.getRange(2, col('action_status'), CHECKBOX_ROWS, 1).setDataValidation(list(ACTION_STATUSES));
  ['reviewed', 'exclude'].forEach(function (n) {
    if (col(n)) codes.getRange(2, col(n), CHECKBOX_ROWS, 1).insertCheckboxes();
  });

  // --- Units ---
  if (units.getLastColumn() === 0) units.getRange(1, 1, 1, 3).setValues([['enrollment_key', 'unit_name', 'active']]);
  units.setFrozenRows(1);
  units.getRange(2, 3, 200, 1).insertCheckboxes();

  // --- Dashboard (formulas; verify in Sheets after the first real upload) ---
  const R = function (name) {
    const c = letter_(col(name));
    return 'Codes!$' + c + '$2:$' + c + '$' + last;
  };
  const real =
    R('training') + '<>TRUE,' + R('void') + '<>TRUE,' + R('exclude') + '<>TRUE,' + R('outcome') + '<>"incomplete"';
  const grp = R('unit') + '=$A5,' + R('start_month') + '=$B5,' + real;
  const med = function (name) {
    return '=IF($A5="","",IFERROR(MEDIAN(FILTER(' + R(name) + '/1000,' + grp + ',' + R(name) + '<>"")),"—"))';
  };
  dash.getRange('A1').setValue('ResusCode — admin dashboard');
  dash.getRange('A2').setValue(
    'Training, void and "exclude" rows and incomplete codes are left out. ROSC = any ROSC (rosc or rosc_then_terminated). Times in seconds from activation, as logged.',
  );
  dash.getRange('A4:H4').setValues([['Unit', 'Month', 'Codes', 'Any ROSC', 'ROSC rate', 'Median first epi (s)', 'Median first shock (s)', 'Median arrest (s)']]);
  dash.getRange('A5').setFormula(
    '=IFERROR(SORT(UNIQUE(FILTER({' + R('unit') + ',' + R('start_month') + '},' + R('unit') + '<>"",' + real + '))),"")',
  );
  const rows = 200;
  const f = [];
  for (let i = 0; i < rows; i++) {
    const r = i + 5;
    const g = grp.replace(/\$A5/g, '$A' + r).replace(/\$B5/g, '$B' + r);
    const m = function (name) {
      return med(name).replace(/\$A5/g, '$A' + r).replace(/\$B5/g, '$B' + r);
    };
    f.push([
      '=IF($A' + r + '="","",IFERROR(ROWS(FILTER(' + R('record_id') + ',' + g + ')),0))',
      '=IF($A' + r + '="","",IFERROR(ROWS(FILTER(' + R('record_id') + ',' + g + ',((' + R('outcome') + '="rosc")+(' + R('outcome') + '="rosc_then_terminated"))>0)),0))',
      '=IF($A' + r + '="","",IF(C' + r + '=0,"",D' + r + '/C' + r + '))',
      m('first_epi_ms'),
      m('first_shock_ms'),
      m('arrest_ms'),
    ]);
  }
  dash.getRange(5, 3, rows, 6).setFormulas(f);
  dash.getRange(5, 5, rows, 1).setNumberFormat('0%');

  // issue categories (reviewed codes only)
  dash.getRange('J4:K4').setValues([['Issue category', 'Codes']]);
  dash.getRange(5, 10, ISSUE_CATEGORIES.length, 1).setValues(ISSUE_CATEGORIES.map(function (c) { return [c]; }));
  const issue = [];
  for (let i = 0; i < ISSUE_CATEGORIES.length; i++) {
    issue.push([
      '=COUNTIFS(' + R('issue_category') + ',$J' + (5 + i) + ',' + R('exclude') + ',"<>TRUE",' + R('training') + ',"<>TRUE",' + R('void') + ',"<>TRUE")',
    ]);
  }
  dash.getRange(5, 11, ISSUE_CATEGORIES.length, 1).setFormulas(issue);

  // last upload per unit (shows silent units, e.g. when replies are unreadable)
  dash.getRange('M4:N4').setValues([['Unit', 'Last upload']]);
  dash.getRange('M5').setFormula('=IFERROR(SORT(UNIQUE(FILTER(' + R('unit') + ',' + R('unit') + '<>""))),"")');
  const lastUp = [];
  for (let i = 0; i < 50; i++) {
    const r = i + 5;
    lastUp.push(['=IF($M' + r + '="","",IFERROR(INDEX(SORT(FILTER(' + R('last_upload_iso') + ',' + R('unit') + '=$M' + r + '),1,FALSE),1),""))']);
  }
  dash.getRange(5, 14, 50, 1).setFormulas(lastUp);
}
```

Add to `package.json` scripts: `"build:apps-script": "node scripts/build-apps-script.mjs"`.

- [ ] **Step 4: Generate and run**

Run: `npm run build:apps-script && npx vitest run src/admin/build.test.ts && npm run typecheck && npm test`
Expected: PASS. The generated `Code.gs` is committed with the sources; `git diff` after rebuilding must be empty.

- [ ] **Step 5: Commit** — `git add admin scripts src/admin/build.test.ts package.json && git commit -m "feat: Apps Script build (sheetCore + wrapper -> Code.gs) with sync test"`

### Task 10: Device history UI (History panel in the Log screen)

**Files:**
- Create: `src/engine/historyFormat.ts`, `src/engine/historyFormat.test.ts` (pure label/row formatters — the only unit-tested part of this task)
- Create: `src/hooks/useService.ts` (`useSyncExternalStore` readers over `service.ts`)
- Create: `src/components/log/HistoryPanel.tsx`, `src/components/log/RecordDetail.tsx`, `src/components/log/download.ts`
- Modify: `src/screens/LogScreen.tsx` (render `<HistoryPanel />` after `SbarExport`, before the event log)

**Interfaces:**
- Produces (`historyFormat.ts`): `UPLOAD_STATUS_LABEL: Record<UploadStatus, string>`, `recordTitle(r, offsetMin?)`, `recordFlags(r) → string[]`, `aggregateRows(a: Aggregates) → StatRow[]`, `medianLabel(m: Median)`.
- Produces (`useService.ts`): `useServiceVersion()`, `useHistoryRecords()` (newest first), `usePrefsState()`, `useOutboxState()`.
- Produces (`download.ts`): `downloadText(filename, text, mime)`.

**Behaviour:**
- The bottom bar stays at three tabs; History is a `Panel` inside Log / SBAR.
- Aggregates: *n* is always shown; counts replace percentages below 5 counted codes; training, void and incomplete are excluded and counted separately; "Any ROSC" is labelled as such.
- Record list: newest first (first 20, "Show all" for the rest); tapping a row opens its summary inline (no modal), reusing `statsRows` so it reads exactly like the live panel.
- In the summary: Training toggle and Void (hold 2 s) / Restore call `editRecordFlags` (which re-sends statistics only when enrolled).
- Export CSV (all records, oldest first) and Clear history (hold 2.5 s, also clears the outbox).

- [ ] **Step 1: Write the failing test** — `src/engine/historyFormat.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { computeAggregates } from './history';
import { aggregateRows, medianLabel, recordFlags, recordTitle, UPLOAD_STATUS_LABEL } from './historyFormat';
import { mkRecord } from './testing/fixtures';

describe('recordTitle / recordFlags', () => {
  it('shows local date-time, outcome and arrest time', () => {
    expect(recordTitle(mkRecord(1), 0)).toBe('2023-11-14 23:13 · ROSC achieved · 10:00');
  });
  it('lists training / void flags', () => {
    expect(recordFlags(mkRecord(1))).toEqual([]);
    expect(recordFlags(mkRecord(1, { training: true, voided: true }))).toEqual(['Training', 'Void']);
  });
  it('has a label for every upload status', () => {
    for (const s of ['local', 'queued', 'sent', 'sent_unconfirmed', 'failed', 'rejected'] as const) {
      expect(UPLOAD_STATUS_LABEL[s]).toBeTruthy();
    }
  });
});

describe('aggregateRows', () => {
  const val = (rows: ReturnType<typeof aggregateRows>, label: string) => rows.find((r) => r.label === label)?.value;

  it('empty history: dashes, never NaN or a fake 0%', () => {
    const rows = aggregateRows(computeAggregates([]));
    expect(val(rows, 'Codes counted')).toBe('0');
    expect(val(rows, 'Any ROSC')).toBe('—');
    expect(val(rows, 'Median first epinephrine')).toBe('— (n=0)');
  });

  it('below 5 counted codes: counts, not a percentage; n is shown', () => {
    const rows = aggregateRows(computeAggregates([mkRecord(1), mkRecord(2, {}, { outcome: 'terminated', roscCount: 0 })]));
    expect(val(rows, 'Any ROSC')).toBe('1 of 2');
    expect(val(rows, 'Median first epinephrine')).toBe('02:00 (n=2)');
  });

  it('5 or more: percentage with the fraction', () => {
    const rs = [1, 2, 3, 4, 5].map((n) => mkRecord(n, {}, n <= 2 ? {} : { outcome: 'terminated', roscCount: 0 }));
    expect(val(aggregateRows(computeAggregates(rs)), 'Any ROSC')).toBe('40% (2/5)');
  });

  it('mentions excluded and incomplete codes separately', () => {
    const rows = aggregateRows(
      computeAggregates([mkRecord(1), mkRecord(2, { training: true }), mkRecord(3, {}, { outcome: 'incomplete', roscCount: 0 })]),
    );
    expect(val(rows, 'Codes counted')).toBe('1 · 1 incomplete · 1 training/void');
  });

  it('medianLabel formats value and n', () => {
    expect(medianLabel({ value: 150_000, n: 3 })).toBe('02:30 (n=3)');
    expect(medianLabel({ value: null, n: 0 })).toBe('— (n=0)');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/engine/historyFormat.test.ts` → FAIL (cannot resolve `./historyFormat`).

- [ ] **Step 3: Implement the formatter** — `src/engine/historyFormat.ts`

```ts
/** Labels and rows for the History panel — pure, so they are unit-tested (the panel itself has no DOM tests). */
import { isoWithOffset, type Aggregates, type CodeRecord, type Median, type UploadStatus } from './history';
import { OUTCOME_LABEL, type StatRow } from './statsFormat';
import { formatClock } from './timing';

export const UPLOAD_STATUS_LABEL: Record<UploadStatus, string> = {
  local: 'On this device only',
  queued: 'Waiting to send',
  sent: 'Sent ✓',
  sent_unconfirmed: 'Sent (not confirmed)',
  failed: 'Will retry',
  rejected: 'Rejected by the sheet',
};

const DASH = '—';

export function recordTitle(r: CodeRecord, offsetMin?: number): string {
  const when = isoWithOffset(r.startedAt, offsetMin).slice(0, 16).replace('T', ' ');
  return `${when} · ${OUTCOME_LABEL[r.stats.outcome].split(',')[0].replace(' (code not ended)', '')} · ${formatClock(r.stats.arrestMs)}`;
}

export function recordFlags(r: CodeRecord): string[] {
  return [r.training ? 'Training' : '', r.voided ? 'Void' : ''].filter(Boolean);
}

export const medianLabel = (m: Median): string => `${m.value == null ? DASH : formatClock(m.value)} (n=${m.n})`;

export function aggregateRows(a: Aggregates): StatRow[] {
  const extras = [a.incomplete ? `${a.incomplete} incomplete` : '', a.excluded ? `${a.excluded} training/void` : ''].filter(Boolean);
  const any =
    a.counted === 0
      ? DASH
      : a.showRates && a.roscRate != null
        ? `${Math.round(a.roscRate * 100)}% (${a.anyRosc}/${a.counted})`
        : `${a.anyRosc} of ${a.counted}`;
  return [
    { label: 'Codes counted', value: [String(a.counted), ...extras].join(' · ') },
    { label: 'Any ROSC', value: any },
    { label: 'Median first epinephrine', value: medianLabel(a.firstEpi) },
    { label: 'Median first shock', value: medianLabel(a.firstShock) },
    { label: 'Median arrest time', value: medianLabel(a.arrest) },
  ];
}
```

*(`OUTCOME_LABEL.rosc_then_terminated` is "ROSC achieved, later terminated"; `recordTitle` keeps only the part before the comma, so the title says "ROSC achieved" — the full outcome is in the opened summary. Adjust the helper if the first test expects otherwise.)*

- [ ] **Step 4: Implement the hooks and UI**

`src/hooks/useService.ts`:

```ts
import { useMemo, useSyncExternalStore } from 'react';
import { getServiceVersion, kv, subscribeService } from '../engine/service';
import { loadHistory, type CodeRecord } from '../engine/history';
import { loadPrefs, type Prefs } from '../engine/prefs';
import { loadOutbox, type OutboxState } from '../engine/outbox';

/** Bumps whenever history / outbox / prefs change (this tab or another). */
export function useServiceVersion(): number {
  return useSyncExternalStore(subscribeService, getServiceVersion, () => 0);
}

/** Newest first. */
export function useHistoryRecords(): CodeRecord[] {
  const v = useServiceVersion();
  return useMemo(() => (kv ? loadHistory(kv).reverse() : []), [v]);
}

export function usePrefsState(): Prefs {
  const v = useServiceVersion();
  return useMemo(() => loadPrefs(kv), [v]);
}

export function useOutboxState(): OutboxState {
  const v = useServiceVersion();
  return useMemo(() => (kv ? loadOutbox(kv) : { entries: {}, lastRejection: null }), [v]);
}
```

`src/components/log/download.ts`:

```ts
/** Save text as a file (same revoke-after-delay pattern as the SBAR download). */
export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

`src/components/log/RecordDetail.tsx`:

```tsx
import type { CodeRecord } from '../../engine/history';
import { STATS_TIME_NOTE, statsRows } from '../../engine/statsFormat';
import { editRecordFlags } from '../../engine/service';
import { Chip } from '../ui/Chip';
import { HoldButton } from '../ui/HoldButton';

/** Inline summary of a past code. Flag edits re-send statistics only when the device is enrolled. */
export function RecordDetail({ record }: { record: CodeRecord }) {
  return (
    <div className="mt-2 rounded-xl border border-line bg-panel2/60 p-2">
      <dl className="grid grid-cols-1 gap-1">
        {statsRows(record.stats).map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 px-1 py-1">
            <dt className="text-xs text-mute">{r.label}</dt>
            <dd className={`tnum text-end text-sm font-bold ${r.flag ? 'text-warn' : 'text-ink'}`}>
              {r.value}
              {r.flag ? ' ⚠' : ''}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[11px] text-mute">{STATS_TIME_NOTE}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Chip selected={record.training} onClick={() => editRecordFlags(record.id, { training: !record.training })}>
          {record.training ? 'Training ✓' : 'Mark as training'}
        </Chip>
        {record.voided ? (
          <Chip selected onClick={() => editRecordFlags(record.id, { voided: false })}>
            Restore (un-void)
          </Chip>
        ) : (
          <HoldButton
            variant="outline"
            label="Void this code"
            sub="Hold 2 s — kept, excluded from stats"
            durationMs={2000}
            onComplete={() => editRecordFlags(record.id, { voided: true })}
          />
        )}
      </div>
    </div>
  );
}
```

`src/components/log/HistoryPanel.tsx`:

```tsx
import { useState } from 'react';
import { Download, History as HistoryIcon, Trash2 } from 'lucide-react';
import { computeAggregates } from '../../engine/history';
import { aggregateRows, recordFlags, recordTitle, UPLOAD_STATUS_LABEL } from '../../engine/historyFormat';
import { csvFilename, recordsToCsv } from '../../engine/csv';
import { clearAllHistory } from '../../engine/service';
import { useHistoryRecords } from '../../hooks/useService';
import { BigButton } from '../ui/BigButton';
import { HoldButton } from '../ui/HoldButton';
import { Panel } from '../ui/Panel';
import { RecordDetail } from './RecordDetail';
import { downloadText } from './download';

const PAGE = 20;

/** Past codes on this device: aggregates, the list, CSV export and clear. Statistics only — no event log is stored. */
export function HistoryPanel() {
  const records = useHistoryRecords();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? records : records.slice(0, PAGE);
  const agg = computeAggregates(records);

  return (
    <Panel title={`History · ${records.length} code${records.length === 1 ? '' : 's'}`} icon={HistoryIcon}>
      {records.length === 0 ? (
        <p className="text-xs text-mute">No finished codes on this device yet. A code is kept here once it ends or is reset.</p>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {aggregateRows(agg).map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 rounded-lg border border-line bg-panel2/60 px-3 py-2">
                <dt className="text-xs text-mute">{r.label}</dt>
                <dd className="tnum text-end text-sm font-bold text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-3 flex flex-col gap-1">
            {shown.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  aria-expanded={openId === r.id}
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  className={`touch-hit w-full rounded-xl border border-line bg-panel2 px-3 py-2 text-start ${r.voided ? 'opacity-60' : ''}`}
                >
                  <span className="tnum block text-sm font-bold text-ink">{recordTitle(r)}</span>
                  <span className="block text-[11px] text-mute">
                    {[...recordFlags(r), UPLOAD_STATUS_LABEL[r.uploadStatus]].join(' · ')}
                  </span>
                </button>
                {openId === r.id ? <RecordDetail record={r} /> : null}
              </li>
            ))}
          </ul>
          {records.length > PAGE ? (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="touch-hit mt-2 text-xs font-bold text-cyber">
              {showAll ? 'Show fewer' : `Show all ${records.length}`}
            </button>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <BigButton
              variant="neutral"
              icon={Download}
              label="Export CSV"
              onClick={() => downloadText(csvFilename(Date.now()), recordsToCsv([...records].reverse()), 'text/csv;charset=utf-8')}
            />
            <HoldButton variant="outline" icon={Trash2} label="Clear history" sub="Hold 2.5 s" durationMs={2500} onComplete={clearAllHistory} />
          </div>
        </>
      )}
      <p className="mt-2 text-[11px] text-mute">Up to 500 codes are kept on this device — statistics only, no event log.</p>
    </Panel>
  );
}
```

`src/screens/LogScreen.tsx`: add `import { HistoryPanel } from '../components/log/HistoryPanel';` and render `<HistoryPanel />` between `<SbarExport />` and the event-log `Panel`.

*(If `BigButton`/`HoldButton` do not accept an `icon` or `sub` prop in the form used above, match their real props from `src/components/ui/`; `SbarExport.tsx` already uses `icon`, `label`, `sub`, `variant`, `size`, `durationMs`, `onComplete`.)*

- [ ] **Step 5: Run** — `npx vitest run src/engine/historyFormat.test.ts && npm run typecheck && npm test && npm run build` → PASS / build succeeds. (UI behaviour is verified in the browser in Task 13.)

- [ ] **Step 6: Commit** — `git add src/engine/historyFormat.ts src/engine/historyFormat.test.ts src/hooks/useService.ts src/components/log src/screens/LogScreen.tsx && git commit -m "feat: device history panel with aggregates, CSV export and record summaries"`

---

### Task 11: Settings sheet, enrollment, test record, backfill

**Files:**
- Create: `src/engine/enrollLink.ts`, `src/engine/enrollLink.test.ts` (pure fragment parsing)
- Create: `src/engine/uploadLabels.ts`, `src/engine/uploadLabels.test.ts` (pure message mapping)
- Create: `src/components/ui/TextField.tsx`
- Create: `src/components/SettingsSheet.tsx`, `src/components/EnrollConfirm.tsx`, `src/components/EnrollmentSummary.tsx`
- Modify: `src/App.tsx` (gear button in the header, `settingsOpen` state, `pendingEnroll` prop, render `EnrollConfirm` + `SettingsSheet`)
- Modify: `src/main.tsx` (`const pendingEnroll = takeEnrollFragment();` before render; `<App pendingEnroll={pendingEnroll} />`)

**Interfaces:**
- Produces (`enrollLink.ts`): `EnrollFragment = { kind: 'none' } | { kind: 'invalid' } | { kind: 'ok'; enrollment: Enrollment }`, `readEnrollFragment(hash)` (pure), `takeEnrollFragment()` (reads `location.hash`, removes it with `history.replaceState`).
- Produces (`uploadLabels.ts`): `testResultMessage(r: SendResult | 'not_enrolled') → { tone: 'good'|'warn'|'crit'; text }`, `rejectionMessage(error: RejectError) → string`.

**Behaviour:**
- Gear icon in the header opens a full-screen overlay (`role="dialog"`, Escape and ✕ close). It works during a code but never covers the clock for longer than the user chooses.
- **Enrollment link:** the fragment is read **once in `main.tsx`, before render** (StrictMode double-invokes initialisers, so reading in a component would lose it), removed from the address bar on every path (valid, invalid, none), and — when valid — shown as a confirmation banner stating exactly what is sent and where; nothing is stored until the user taps Enroll. A link that replaces an existing enrollment says so.
- **Pasted code / link** (required on iOS, where Safari and the home-screen app have separate storage): same validation (`parseEnrollmentCode`), same confirmation text.
- **Upload status:** enrolled/not, unit, destination tail, pending count, and the stored rejection message (`key` → "Enrollment invalid — contact admin"; `schema`/`version` → "Update app"; `size` → "A record was too large — contact admin").
- **Send test record** → `sendTestRecord()` → inline message from `testResultMessage` (never queued).
- **Backfill prompt:** while enrolled and `backfillCount() > 0`: "Send N earlier codes (statistics only)?" with Send / Not now. Opened automatically right after enrolling.
- **Retention:** Keep all / Keep last N (50, 100, 200) / Delete after confirmed upload.
- **Leave:** HoldButton "Stop uploading on this device" → `unenrollDevice()`.
- Privacy text: what is sent (statistics, start date/time, unit, an SBAR summary with relative times) and what is not (no patient identifiers).

- [ ] **Step 1: Write the failing tests**

`src/engine/enrollLink.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { encodeEnrollment } from './prefs';
import { readEnrollFragment } from './enrollLink';

const e = { url: 'https://script.google.com/macros/s/AKfycbxAbC/exec', key: 'unit-icu-2026', unit: 'ICU' };

describe('readEnrollFragment', () => {
  it('no fragment, or an unrelated one, is none', () => {
    expect(readEnrollFragment('')).toEqual({ kind: 'none' });
    expect(readEnrollFragment('#')).toEqual({ kind: 'none' });
    expect(readEnrollFragment('#something')).toEqual({ kind: 'none' });
  });
  it('a valid code is ok', () => {
    expect(readEnrollFragment(`#enroll=${encodeEnrollment(e)}`)).toEqual({ kind: 'ok', enrollment: e });
  });
  it('an enroll fragment that does not validate is invalid, never ok', () => {
    expect(readEnrollFragment('#enroll=garbage')).toEqual({ kind: 'invalid' });
    expect(readEnrollFragment('#enroll=')).toEqual({ kind: 'invalid' });
    const evil = encodeEnrollment({ ...e, url: 'https://script.google.com/macros/s/AKfycbxAbC/exec' }).replace(/./, 'A');
    expect(readEnrollFragment(`#enroll=${evil}`).kind).not.toBe('ok');
  });
});
```

`src/engine/uploadLabels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rejectionMessage, testResultMessage } from './uploadLabels';

describe('testResultMessage', () => {
  it('maps every outcome to a tone and text', () => {
    expect(testResultMessage({ status: 'sent' })).toMatchObject({ tone: 'good' });
    expect(testResultMessage({ status: 'sent_unconfirmed' })).toMatchObject({ tone: 'warn' });
    expect(testResultMessage({ status: 'rejected', error: 'key' }).text).toContain('Enrollment invalid');
    expect(testResultMessage({ status: 'rejected', error: 'version' }).text).toContain('Update');
    expect(testResultMessage({ status: 'failed', reason: 'offline' }).text).toContain('offline');
    expect(testResultMessage({ status: 'failed', reason: 'not_json' }).text).toContain('Anyone');
    expect(testResultMessage({ status: 'failed', reason: 'network' }).tone).toBe('crit');
    expect(testResultMessage('not_enrolled').tone).toBe('warn');
  });
  it('sent_unconfirmed explains that the reply cannot be read', () => {
    expect(testResultMessage({ status: 'sent_unconfirmed' }).text).toMatch(/not confirmed|can't read/i);
  });
  it('rejection messages for the stored state', () => {
    expect(rejectionMessage('key')).toBe('Enrollment invalid — contact admin');
    expect(rejectionMessage('schema')).toBe('Update app');
    expect(rejectionMessage('version')).toBe('Update app');
    expect(rejectionMessage('size')).toContain('too large');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/engine/enrollLink.test.ts src/engine/uploadLabels.test.ts` → FAIL (cannot resolve the modules).

- [ ] **Step 3: Implement the pure modules**

`src/engine/enrollLink.ts`:

```ts
/** Reads the one-time `#enroll=<code>` fragment of an enrollment link. */
import { parseEnrollmentCode, type Enrollment } from './prefs';

export type EnrollFragment = { kind: 'none' } | { kind: 'invalid' } | { kind: 'ok'; enrollment: Enrollment };

export function readEnrollFragment(hash: string): EnrollFragment {
  if (!/(^|[#&])enroll=/.test(hash)) return { kind: 'none' };
  const enrollment = parseEnrollmentCode(hash.replace(/^#/, ''));
  return enrollment ? { kind: 'ok', enrollment } : { kind: 'invalid' };
}

/**
 * Called ONCE from main.tsx before render (React StrictMode runs initialisers twice, so reading
 * in a component would lose the fragment). The fragment is removed from the address bar on every path.
 */
export function takeEnrollFragment(): EnrollFragment {
  if (typeof window === 'undefined') return { kind: 'none' };
  const result = readEnrollFragment(window.location.hash);
  if (result.kind !== 'none') {
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      /* best effort */
    }
  }
  return result;
}
```

`src/engine/uploadLabels.ts`:

```ts
import type { RejectError, SendResult } from './upload';

export interface Message {
  tone: 'good' | 'warn' | 'crit';
  text: string;
}

export function rejectionMessage(error: RejectError): string {
  switch (error) {
    case 'key':
      return 'Enrollment invalid — contact admin';
    case 'schema':
    case 'version':
      return 'Update app';
    case 'size':
      return 'A record was too large for the sheet — contact admin';
  }
}

export function testResultMessage(r: SendResult | 'not_enrolled'): Message {
  if (r === 'not_enrolled') return { tone: 'warn', text: 'This device is not enrolled yet.' };
  switch (r.status) {
    case 'sent':
      return { tone: 'good', text: 'Delivered and confirmed ✓ — a TEST row should now be in the sheet.' };
    case 'sent_unconfirmed':
      return {
        tone: 'warn',
        text: "Sent, but this browser can't read the reply, so delivery is not confirmed. Check the sheet for a TEST row.",
      };
    case 'rejected':
      return { tone: 'crit', text: `${rejectionMessage(r.error)}.` };
    case 'failed':
      if (r.reason === 'offline') return { tone: 'warn', text: "You're offline — try again when connected." };
      if (r.reason === 'not_json') {
        return {
          tone: 'crit',
          text: 'The script answered with an error page. Check the deployment is set to "Anyone" and is the latest version.',
        };
      }
      return { tone: 'crit', text: `Could not reach the script (${r.reason}).` };
  }
}
```

- [ ] **Step 4: Implement the UI**

`src/components/ui/TextField.tsx`:

```tsx
export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  error?: string | null;
}

/** Single-line text input in the app's dark style (the app had no form fields before Settings). */
export function TextField({ label, value, onChange, placeholder, mono, error }: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-mute">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={`min-h-[56px] w-full rounded-xl border bg-panel2 px-3 text-base text-ink outline-none placeholder:text-mute focus:border-cyber ${
          error ? 'border-crit' : 'border-line'
        } ${mono ? 'font-mono text-sm' : ''}`}
      />
      {error ? <span className="mt-1 block text-xs font-semibold text-crit">{error}</span> : null}
    </label>
  );
}
```

`src/components/EnrollmentSummary.tsx` (shared by the link banner and the Settings paste flow, so both state exactly what is sent):

```tsx
import type { Enrollment } from '../engine/prefs';

/** `…` plus the last 8 characters of the script id — enough to recognise a destination, not the whole URL. */
export function destinationTail(url: string): string {
  const m = /\/s\/([^/]+)\/exec$/.exec(url);
  return m ? `…${m[1].slice(-8)}` : '…';
}

export function EnrollmentSummary({ enrollment, replacing }: { enrollment: Enrollment; replacing: boolean }) {
  return (
    <div className="text-xs leading-relaxed text-ink">
      <p>
        If you enroll, each finished code&apos;s statistics (times, shocks, drugs, outcome), its start date and time, your
        unit and a summary note with relative times — never patient identifiers — are sent to the Google Sheet of the admin
        who issued this code.
      </p>
      <p className="mt-1 text-mute">
        Destination <span className="font-mono">{destinationTail(enrollment.url)}</span>
        {enrollment.unit ? (
          <>
            {' '}
            · Unit <b className="text-ink">{enrollment.unit}</b>
          </>
        ) : null}
      </p>
      {replacing ? <p className="mt-1 font-bold text-warn">This replaces your current enrollment.</p> : null}
      <p className="mt-1 text-mute">Nothing is sent until you tap Enroll. You can stop at any time in Settings.</p>
    </div>
  );
}
```

`src/components/EnrollConfirm.tsx`:

```tsx
import { useState } from 'react';
import type { EnrollFragment } from '../engine/enrollLink';
import { enrollDevice, getPrefs } from '../engine/service';
import { BigButton } from './ui/BigButton';
import { EnrollmentSummary } from './EnrollmentSummary';

/** Shown once when the app was opened from an enrollment link. Nothing is stored until Enroll is tapped. */
export function EnrollConfirm({ fragment, onEnrolled }: { fragment: EnrollFragment; onEnrolled: () => void }) {
  const [done, setDone] = useState(false);
  if (done || fragment.kind === 'none') return null;

  if (fragment.kind === 'invalid') {
    return (
      <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl border border-crit/60 bg-crit/10 p-3 text-xs font-semibold text-crit">
        <span className="flex-1">That enrollment link was not valid and was ignored.</span>
        <button type="button" onClick={() => setDone(true)} className="touch-hit rounded-lg border border-crit/60 px-3 py-2 font-bold">
          Dismiss
        </button>
      </div>
    );
  }

  const e = fragment.enrollment;
  return (
    <div className="mb-3 rounded-xl border border-cyber/60 bg-cyber/10 p-3">
      <p className="mb-1 text-sm font-bold text-cyber">Enroll this device for code upload?</p>
      <EnrollmentSummary enrollment={e} replacing={getPrefs().enrollment != null} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <BigButton
          variant="cyber"
          label="Enroll"
          onClick={() => {
            enrollDevice(e);
            setDone(true);
            onEnrolled();
          }}
        />
        <BigButton variant="outline" label="Cancel" onClick={() => setDone(true)} />
      </div>
    </div>
  );
}
```

`src/components/SettingsSheet.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { KEEP_OPTIONS, parseEnrollmentCode, type Enrollment, type RetentionMode } from '../engine/prefs';
import { backfillCount, enrollDevice, sendBackfill, sendTestRecord, setRetention, unenrollDevice } from '../engine/service';
import { rejectionMessage, testResultMessage, type Message } from '../engine/uploadLabels';
import { useOutboxState, usePrefsState, useServiceVersion } from '../hooks/useService';
import { BigButton } from './ui/BigButton';
import { Chip } from './ui/Chip';
import { HoldButton } from './ui/HoldButton';
import { Panel } from './ui/Panel';
import { TextField } from './ui/TextField';
import { EnrollmentSummary, destinationTail } from './EnrollmentSummary';

const TONE: Record<Message['tone'], string> = { good: 'text-good', warn: 'text-warn', crit: 'text-crit' };

const RETENTION_MODES: Array<[RetentionMode, string]> = [
  ['all', 'Keep all'],
  ['last', 'Keep last…'],
  ['after_upload', 'Delete after upload'],
];

/** Full-screen sheet behind the header gear. The clock keeps running underneath. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = usePrefsState();
  const outbox = useOutboxState();
  useServiceVersion(); // re-render after any write (backfillCount reads storage directly)
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<Enrollment | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<Message | null>(null);
  const [backfillDismissed, setBackfillDismissed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const enrolled = prefs.enrollment;
  const queuedCount = Object.keys(outbox.entries).length;
  const toBackfill = enrolled && !backfillDismissed ? backfillCount() : 0;

  const checkCode = () => {
    const e = parseEnrollmentCode(code);
    if (!e) {
      setPending(null);
      setCodeError("That code isn't valid.");
      return;
    }
    setCodeError(null);
    setPending(e);
  };
  const confirmEnroll = () => {
    if (!pending) return;
    enrollDevice(pending);
    setPending(null);
    setCode('');
    setTestMsg(null);
    setBackfillDismissed(false);
  };
  const runTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      setTestMsg(testResultMessage(await sendTestRecord()));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Settings" className="fixed inset-0 z-40 overflow-y-auto bg-bg">
      <div className="safe-top sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <h2 className="text-base font-bold text-ink">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="touch-hit ms-auto flex h-10 w-10 items-center justify-center rounded-full border border-line text-mute"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 pt-3 pb-appbar">
        <Panel title="Code upload" accent={enrolled ? 'cyber' : 'none'}>
          {enrolled ? (
            <>
              <p className="text-sm text-ink">
                Enrolled{enrolled.unit ? ` · ${enrolled.unit}` : ''} · <span className="font-mono">{destinationTail(enrolled.url)}</span>
              </p>
              <p className="mt-1 text-xs text-mute">
                {queuedCount ? `${queuedCount} code${queuedCount === 1 ? '' : 's'} waiting to send.` : 'Nothing waiting to send.'}
              </p>
              {outbox.lastRejection ? (
                <p role="alert" className="mt-1 text-xs font-bold text-crit">
                  {rejectionMessage(outbox.lastRejection.error)}
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <BigButton variant="neutral" icon={Send} label={testing ? 'Sending…' : 'Send test record'} disabled={testing} onClick={runTest} />
                <HoldButton
                  variant="outline"
                  label="Stop uploading"
                  sub="Hold 2 s — this device only"
                  durationMs={2000}
                  onComplete={unenrollDevice}
                />
              </div>
              {testMsg ? (
                <p role="status" className={`mt-2 text-xs font-bold ${TONE[testMsg.tone]}`}>
                  {testMsg.text}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-mute">
              Upload is off. Codes stay on this device. Your unit&apos;s admin can give you an enrollment link or code.
            </p>
          )}
        </Panel>

        {toBackfill > 0 ? (
          <Panel title="Earlier codes" accent="cyber">
            <p className="text-sm text-ink">
              Send {toBackfill} earlier code{toBackfill === 1 ? '' : 's'} (statistics only)?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <BigButton variant="cyber" label="Send" onClick={() => sendBackfill()} />
              <BigButton variant="outline" label="Not now" onClick={() => setBackfillDismissed(true)} />
            </div>
          </Panel>
        ) : null}

        <Panel title="Enroll with a code">
          <TextField
            label="Paste the enrollment code or link"
            value={code}
            onChange={(v) => {
              setCode(v);
              setCodeError(null);
              setPending(null);
            }}
            placeholder="https://…#enroll=…  or the code after #enroll="
            mono
            error={codeError}
          />
          {pending ? (
            <div className="mt-2 rounded-xl border border-cyber/60 bg-cyber/10 p-3">
              <EnrollmentSummary enrollment={pending} replacing={enrolled != null} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <BigButton variant="cyber" label="Enroll" onClick={confirmEnroll} />
                <BigButton variant="outline" label="Cancel" onClick={() => setPending(null)} />
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <BigButton variant="neutral" label="Check code" disabled={!code.trim()} onClick={checkCode} />
            </div>
          )}
        </Panel>

        <Panel title="History on this device">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {RETENTION_MODES.map(([mode, label]) => (
              <Chip key={mode} selected={prefs.retention.mode === mode} onClick={() => setRetention({ ...prefs.retention, mode })}>
                {label}
              </Chip>
            ))}
          </div>
          {prefs.retention.mode === 'last' ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {KEEP_OPTIONS.map((n) => (
                <Chip key={n} selected={prefs.retention.keep === n} onClick={() => setRetention({ ...prefs.retention, keep: n })}>
                  {n}
                </Chip>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-mute">
            Up to 500 codes are kept. &quot;Delete after upload&quot; removes a code from this device only once the sheet has confirmed it.
          </p>
        </Panel>

        <Panel title="This device">
          <p className="text-xs text-mute">
            Device id <span className="selectable font-mono text-ink">{prefs.deviceId}</span>
          </p>
          <p className="mt-1 text-[11px] text-mute">
            Random, created on this device. When enrolled, finished codes send their statistics, start date and time, your unit and
            a summary note with relative times. No patient identifiers are ever recorded.
          </p>
        </Panel>
      </div>
    </div>
  );
}
```

`src/App.tsx`: add `Settings` to the `lucide-react` import; `const [settingsOpen, setSettingsOpen] = useState(false);`; add `pendingEnroll: EnrollFragment` to the component props (`export default function App({ pendingEnroll }: { pendingEnroll: EnrollFragment })`); in the header's right-hand cluster add

```tsx
<button
  type="button"
  aria-label="Settings"
  onClick={() => setSettingsOpen(true)}
  className="touch-hit flex h-9 w-9 items-center justify-center rounded-full border border-line text-mute"
>
  <Settings className="h-4 w-4" />
</button>
```

render `<EnrollConfirm fragment={pendingEnroll} onEnrolled={() => setSettingsOpen(true)} />` above `<ClockChangeNotice />`, and `<SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />` at the end of the root `div`.

`src/main.tsx`: `import { takeEnrollFragment } from './engine/enrollLink';` then `const pendingEnroll = takeEnrollFragment();` immediately before `createRoot`, and render `<App pendingEnroll={pendingEnroll} />`.

- [ ] **Step 5: Run** — `npx vitest run src/engine/enrollLink.test.ts src/engine/uploadLabels.test.ts && npm run typecheck && npm test && npm run build` → PASS / build succeeds. (UI is verified in the browser in Task 13.)

- [ ] **Step 6: Commit** — `git add src/engine/enrollLink.ts src/engine/enrollLink.test.ts src/engine/uploadLabels.ts src/engine/uploadLabels.test.ts src/components src/App.tsx src/main.tsx && git commit -m "feat: Settings sheet with enrollment, test record, backfill and retention"`

---

### Task 12: Wording, spec sync and admin documentation

**Files:**
- Modify: `src/App.tsx` (footer), `src/components/log/SbarExport.tsx` (hint under Reset), `src/engine/persistence.ts` (header comment), `vite.config.ts` (manifest `description`), `index.html` (the matching meta description, around line 11), `package.json` (`description`), `README.md` (lines ~11–12 "sends no data anywhere", ~18 "no modals")
- Modify: `docs/superpowers/specs/2026-10-16-stats-admin-i18n-design.md` (§5 sync note, below)
- Create: `admin/SETUP.md`

The words "PHI-free" and "no data leaves this device" are only true while the device is un-enrolled. Replace them with text that stays true in both cases, and never claim the device is offline-only.

- [ ] **Step 1: Replace the claims** (exact intent; keep each sentence short):
  - `src/App.tsx` footer: "PHI-free — no patient identifiers are recorded. Data stays on this device unless your unit has enrolled it for code upload (Settings)."
  - `src/components/log/SbarExport.tsx` hint: "Hold 2.5 s to clear the current code from the screen. Finished codes stay in History on this device."
  - `src/engine/persistence.ts` header: replace "Nothing ever leaves the device." with "Nothing leaves the device unless an admin has enrolled it for upload (see history.ts / outbox.ts)."
  - `vite.config.ts`, `index.html`, `package.json`: keep "PHI-free and offline-first" but add "optional anonymous statistics upload when your unit enrolls the device".
  - `README.md`: describe the optional upload (what is sent, off until enrolled, link to `admin/SETUP.md`) and change "no modals" to "Settings is a full-screen sheet; there are no other modals".

- [ ] **Step 2: Sync the spec with what this plan decided.** In `docs/superpowers/specs/2026-10-16-stats-admin-i18n-design.md` §5 add a short "Plan decisions" note covering: `sheetCore` is `.js` + `.d.ts`; no standalone spike (adaptive delivery + Send test record); `start_month` column; "ROSC rate = any ROSC"; uploaded SBAR is built with `relativeOnly`; enrollment URL allowlist and optional `unit`; `setupAdminSheet()` creates the tabs, validations and Dashboard; test count 129.

- [ ] **Step 3: Write `admin/SETUP.md`** with these sections (plain language, numbered, for a non-developer admin):
  1. **What this is** — one sheet you own receives finished-code statistics from enrolled devices; no patient identifiers; you write the debrief in the admin columns.
  2. **Create the sheet** — new Google Sheet → Extensions → Apps Script.
  3. **Paste the script** — replace the default code with the whole of `admin/apps-script/Code.gs` (and, optionally, Project Settings → "Show appsscript.json" → paste `admin/apps-script/appsscript.json`).
  4. **Run `setupAdminSheet` once** and approve the permission prompt: creates `Codes`, `Units`, `Dashboard`, the dropdowns and checkboxes.
  5. **Add your units** — one row per unit on `Units`: `enrollment_key` (8–64 letters, digits, `-` or `_`; make it random), `unit_name`, `active` ticked. To revoke a unit, untick `active`.
  6. **Deploy** — Deploy → New deployment → Web app → Execute as: **Me**, Who has access: **Anyone** → copy the `/exec` URL. **To change the code later: Deploy → Manage deployments → ✏ → Version: New version → Deploy. Never "New deployment" — it changes the URL and every enrolled device stops working.**
  7. **Check it** — open the `/exec` URL in a private window: it must say `ok`. "Script function not found: doGet" means the deployed project does not contain this code, or an old version is deployed.
  8. **Make an enrollment link** — a browser-console snippet (below), then share the link or paste it into any QR-code generator. Treat the link like a password: anyone with it can add rows to your sheet.
     ```js
     const e = { url: 'https://script.google.com/macros/s/XXXX/exec', key: 'your-unit-key', unit: 'ICU' };
     const b = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(e))))
       .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
     console.log('https://drabdo1990.github.io/ACLS-assist/#enroll=' + b);
     ```
  9. **iPhone / iPad** — Safari and the home-screen app keep separate storage: open the installed app → Settings → paste the code (the part after `#enroll=`, or the whole link).
  10. **Check a device** — Settings → **Send test record**: a `TEST-…` row appears (it is flagged training and ignored by the Dashboard). The message tells you whether the browser can read the reply ("confirmed") or not ("sent, not confirmed" — the Dashboard's *Last upload* column then shows which units are silent).
  11. **Columns** — device-owned columns are written by the script and overwritten on every upload; admin-owned columns (`debrief_note`, `issue_category`, `action_status`, `reviewed`, `reviewer`, `review_date`, `exclude`, `duplicate_of`) are never touched. You may reorder columns; do not rename device columns. A cell that starts with `=`, `+`, `-` or `@` is stored with a leading apostrophe on purpose.
  12. **Dashboard** — formulas by unit and month, excluding training, void, `exclude` and incomplete codes; "Any ROSC" counts `rosc` and `rosc_then_terminated`. *The Dashboard formulas were not run against a live sheet when this was written — check the first real upload.*
  13. **Before clinical use (release gate)** — written approval from hospital data governance covering: what is sent (statistics, start date/time, unit, a summary note), who can open the sheet, and retention on devices and in the sheet. Start date/time plus unit can identify a patient indirectly even without names. Access to the sheet is controlled only by its Google sharing settings.
  14. **Troubleshooting** — a table mapping the Settings messages (`Enrollment invalid — contact admin`, `Update app`, "error page", "can't read the reply") to the fix.

- [ ] **Step 4: Guard grep** — Run: `git grep -n -i -E "no data leaves|sends no data|No data was ever" -- README.md index.html src vite.config.ts package.json` — Expected: no matches.

- [ ] **Step 5: Run** — `npm run typecheck && npm test && npm run build` → PASS.

- [ ] **Step 6: Commit** — `git add -A src README.md index.html vite.config.ts package.json docs admin/SETUP.md && git commit -m "docs: honest upload wording, spec sync and admin setup guide"`

---

### Task 13: End-to-end verification, review and release gate

**Files:** none (verification, then fixes the review finds).

- [ ] **Step 1: Full suite and build.** Run: `npm run typecheck && npm test && npm run build && npm run build:apps-script && git diff --exit-code admin/apps-script/Code.gs`. Expected: all green, and no diff (the committed `Code.gs` is current).

- [ ] **Step 2: Browser check at phone width (375×812).** Start `resuscode-dev` (`.claude/launch.json`, port 5173). A hidden pane freezes `requestAnimationFrame` (HoldButtons stall), so drive actions through the store: `const s = (await import('/src/engine/store.ts')).useCodeStore.getState()`.
  1. `startCode()`, `administerEpi()`, `deliverShock(200)`, `declareRosc()`. Expect `localStorage['resuscode.history.v1']` to hold **1** record (outcome `rosc`, status `local`). Open **Log / SBAR**: the History panel lists it with n=1 and "Any ROSC 1 of 1".
  2. Toggle training in the opened row → the aggregate count drops to 0 counted / 1 training. Toggle back.
  3. `reset()` → still **1** record (same id, no duplicate). `startCode()` then `reset()` within seconds → **no** new record (trivial code). Start a code, wait > 60 s of arrest time or log a shock, `reset()` mid-arrest → a record with outcome *Incomplete*.
  4. **Export CSV**: the file downloads; the first bytes are the UTF-8 BOM.
  5. **Settings**: open from the gear; paste a locally generated enrollment code with a syntactically valid URL (`https://script.google.com/macros/s/AKfycbxFAKE/exec`) → confirmation text appears → Enroll → status "enrolled", backfill prompt "Send 1 earlier code…". Tap **Send test record**: the pane cannot reach Google, so expect the failure message, not a crash, and **no** record in History. Tap Not now, then **Stop uploading** (hold) → `resuscode.outbox.v1` is gone and statuses are back to `local`.
  6. Open `/#enroll=garbage` → the "link was not valid and was ignored" banner, and the fragment is gone from the address bar. Open `/#enroll=<valid code>` → confirmation banner, fragment removed, nothing stored until Enroll.
  7. Console: no errors; layout has no horizontal scroll at 375 px; the clock and tab bar are unaffected while Settings is open.

- [ ] **Step 3: Real endpoint check by `curl` (needs the admin's deployed `/exec` URL and a Units key — not assumed to exist; the browser pane cannot reach Google).** Save a synthetic payload as `payload.json` (valid `recordId` `1700003600000-a1b2c3d4e5f6`, `deviceId` `a1b2c3d4e5f6`, the unit key, a minimal `stats` object as in `mkStats`). **Do not pass `-X POST` with `-L`**: curl would re-POST to Google's redirect target and get a 405; `--data-binary` with `-L` correctly turns the redirected request into a GET.

  ```bash
  curl -sL -H 'Content-Type: text/plain' --data-binary @payload.json "$EXEC_URL"
  ```
  Expect `{"ok":true}` and one new row; run it again → still one row (idempotent); change the key → `{"ok":false,"error":"key"}`; send `{` → `{"ok":false,"error":"schema"}`; open `$EXEC_URL` in a browser → `ok`. If the reply is an HTML page, the deployment is not set to "Anyone" or is an old version (see `admin/SETUP.md`).

- [ ] **Step 4: Settle readable vs unconfirmed.** After the PR is deployed to GitHub Pages, enroll one real device (or the Pages origin in a desktop browser) and tap **Send test record**. "Delivered and confirmed ✓" means the reply is readable from `https://drabdo1990.github.io`; "sent, not confirmed" means the `no-cors` path applies. Record which in the PR description and in the roadmap memory.

- [ ] **Step 5: One fresh reviewer.** Dispatch a single fresh reviewer (`superpowers:requesting-code-review`) over the whole branch diff with the **Review Focus** list at the top of this plan. Fix real findings with a failing test first; record deliberate non-fixes.

- [ ] **Step 6: Release gate and merge.** Do **not** merge to `main` directly — `main` auto-deploys to GitHub Pages. Open a PR from `phase2-history-upload`, include Steps 2–4 results, and state plainly that **no unit may be enrolled for real use until hospital data governance has approved** what is sent, who can see the sheet, and retention (spec §8; `admin/SETUP.md` §13). Upload stays off for every device until an admin issues an enrollment link, so merging does not by itself send anything.

- [ ] **Step 7: Update the roadmap memory** (`resuscode-roadmap-status`): phase 2 shipped (or what remains), the readable-vs-unconfirmed result from Step 4, and that Phase 3 (Arabic/English, RTL — clinical Arabic needs clinician sign-off) is next.

---

## Execution order and branching

Before Task 1: `git switch -c phase2-history-upload` (the repo's `main` auto-deploys). Run the tasks in numeric order. Dependencies, for anyone splitting the work:

| Task | Needs |
|---|---|
| 1 KV + prefs | — |
| 2 History core + fixtures | 1 (`KV`, `Retention`, `memoryKV`) |
| 3 CSV | 2 |
| 4 Relative SBAR | — (touches only `sbar.ts`; its test also imports the Task 2 fixtures) |
| 5 Capture | 1, 2, 4 |
| 6 Upload payload / delivery | 2 |
| 7 Outbox + service | 1, 2, 5, 6 |
| 8 `sheetCore` | 2, 6 (the contract test imports the real client payload builder and fixtures) |
| 9 Apps Script build | 8 |
| 10 History UI | 7 |
| 11 Settings UI | 7, 10 (shares `useService.ts`) |
| 12 Wording + docs | 9, 11 |
| 13 Verification | all |

The admin side (8–9) and the UI side (10–11) touch disjoint files, so they can run in separate sessions once Task 7 is done; never two writers on `src/engine/service.ts` or `src/App.tsx`.
