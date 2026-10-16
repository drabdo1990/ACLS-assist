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
