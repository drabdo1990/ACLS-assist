import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../engine/audio', () => ({ playChime: vi.fn(), playClose: vi.fn(), playConfirm: vi.fn() }));
vi.mock('../engine/clock', () => ({ clockNow: () => Date.now(), resyncClock: () => {} }));

import { EN, type MessageKey } from './en';
import { AR } from './ar';
import { translate, hasKey } from './translate';
import { enText } from './enText';
import { formatDateTime, formatDurationFor, ltr } from './format';
import { applyDocumentLang, detectLang, getLang, LANG_KEY, readLang, setLang, subscribeLang } from './lang';
import { memoryKV } from '../engine/testing/memoryKV';
import { useCodeStore } from '../engine/store';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Keys whose Arabic deliberately differs in params (keep this list short and justified). */
const PARAM_EXCEPTIONS: readonly string[] = [];

describe('dictionaries', () => {
  it('every en key exists in ar with the same {params}', () => {
    const enKeys = Object.keys(EN) as MessageKey[];
    expect(enKeys.length).toBeGreaterThan(10);
    for (const k of enKeys) {
      expect(typeof AR[k], `missing ar: ${k}`).toBe('string');
      expect(AR[k].trim().length, `empty ar: ${k}`).toBeGreaterThan(0);
      if (!PARAM_EXCEPTIONS.includes(k)) expect(placeholders(AR[k]), `params differ: ${k}`).toEqual(placeholders(EN[k]));
    }
    expect(Object.keys(AR).sort()).toEqual([...enKeys].sort());
  });

  it('generates clinical content keys from the content data', () => {
    expect(EN['cause.hypoxia.label']).toBe('Hypoxia');
    expect(EN['pocus.effusion.label']).toBe('Pericardial effusion');
    expect(EN['postRosc.ecg']).toBe('12-lead ECG — STEMI → Cath Lab; decides ICU vs CCU');
  });
});

describe('translate', () => {
  it('interpolates params and resolves @ keys per language', () => {
    expect(translate('en', 'cause.hypoxia.label')).toBe('Hypoxia');
    expect(translate('ar', 'cause.hypoxia.label')).toBe(AR['cause.hypoxia.label']);
    expect(hasKey('cause.hypoxia.label')).toBe(true);
    expect(hasKey('nope.never')).toBe(false);
  });

  it('never throws: unknown key falls back to the key, unknown lang to English', () => {
    expect(translate('ar', 'nope.never' as MessageKey)).toBe('nope.never');
    expect(translate('xx' as never, 'cause.hypoxia.label')).toBe('Hypoxia');
    expect(() => translate('en', 'cause.hypoxia.label', { x: undefined as never })).not.toThrow();
  });

  it('formats *Ms params as durations: English words, Arabic clock', () => {
    expect(formatDurationFor('en', 405_000)).toBe('6m 45s');
    expect(formatDurationFor('ar', 405_000)).toBe('06:45');
  });

  it('enText renders English with @ keys resolved', () => {
    expect(enText('cause.toxins.label')).toBe('Toxins');
  });
});

describe('dates', () => {
  const ts = Date.UTC(2026, 9, 16, 12, 0, 0);
  it('ar-SA comes out Gregorian with Latin digits', () => {
    const s = formatDateTime(ts, 'ar', 'ar-SA');
    expect(s).toContain('2026');
    expect(s).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
    expect(s).not.toMatch(/144\d|1448/);
  });
  it('English uses the Gregorian year too', () => {
    expect(formatDateTime(ts, 'en')).toContain('2026');
    expect(formatDateTime(ts, 'en', 'ar-SA')).toContain('2026');
  });
  it('ltr wraps in LRI…PDI', () => {
    expect(ltr('[01:00]')).toBe('\u2066[01:00]\u2069');
  });
});

describe('language state', () => {
  it('detects Arabic from navigator.languages[0] only', () => {
    expect(detectLang(['ar-SA', 'en'])).toBe('ar');
    expect(detectLang(['ar'])).toBe('ar');
    expect(detectLang(['en-US', 'ar'])).toBe('en');
    expect(detectLang(['arn'])).toBe('en');
    expect(detectLang([])).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });

  it('a stored choice wins over detection; garbage is ignored', () => {
    expect(readLang(memoryKV({ [LANG_KEY]: 'en' }), ['ar-SA'])).toBe('en');
    expect(readLang(memoryKV({ [LANG_KEY]: 'fr' }), ['ar-SA'])).toBe('ar');
    expect(readLang(null, ['en'])).toBe('en');
  });

  it('applyDocumentLang sets lang and dir', () => {
    const doc = { documentElement: { lang: '', dir: '' } } as unknown as Document;
    applyDocumentLang('ar', doc);
    expect(doc.documentElement.lang).toBe('ar');
    expect(doc.documentElement.dir).toBe('rtl');
    applyDocumentLang('en', doc);
    expect(doc.documentElement.dir).toBe('ltr');
  });

  describe('switching language never touches the session', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      useCodeStore.getState().reset();
    });
    afterEach(() => {
      setLang('en', memoryKV());
      vi.useRealTimers();
    });

    it('persists the choice, notifies, and bumps no rev', () => {
      const s = useCodeStore.getState;
      s().startCode();
      s().administerEpi();
      const before = { rev: s().rev, events: s().events };
      const kv = memoryKV();
      const fn = vi.fn();
      const off = subscribeLang(fn);
      setLang('ar', kv);
      off();
      expect(getLang()).toBe('ar');
      expect(kv.get(LANG_KEY)).toBe('ar');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(s().rev).toBe(before.rev);
      expect(s().events).toBe(before.events);
    });
  });
});
