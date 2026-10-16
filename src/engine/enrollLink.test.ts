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
