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
