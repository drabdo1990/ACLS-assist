import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./audio', () => ({ playChime: vi.fn(), playClose: vi.fn(), playConfirm: vi.fn() }));
vi.mock('./clock', () => ({ clockNow: () => Date.now(), resyncClock: () => {} }));

import { useCodeStore } from './store';
import { driveEveryEvent } from './testing/driveEvents';
import golden from './testing/goldenEvents.json';
import { checklistOnLabel, checklistToggle, isChecklistItemOn, POST_ROSC_CHECKLIST_I18N } from './checklist';
import { POST_ROSC_PREFIX } from './eventQueries';
import { POST_ROSC_BUNDLE } from '../content/protocols';
import { keyed, enText } from '../i18n/enText';
import { eventText } from '../i18n/eventText';
import { setLang } from '../i18n/lang';
import { memoryKV } from './testing/memoryKV';
import { sanitizeSession, emptySession } from './persistence';
import type { CodeEvent } from './types';
import type { MessageKey } from '../i18n/en';

const s = () => useCodeStore.getState();
const ecg = POST_ROSC_BUNDLE.find((i) => i.id === 'ecg')!;

/** What the components do: InterventionGrid's pulse check and Checklist's toggle. */
function drive() {
  driveEveryEvent({
    pulseCheck: () => {
      const m = keyed('ev.pulseCheck', undefined, 'ev.pulseCheck.detail');
      s().logEvent('rhythm', m.label, m.detail, m.i18n);
    },
    checklistToggle: () => {
      const m = checklistToggle(s().events, POST_ROSC_PREFIX, ecg, POST_ROSC_CHECKLIST_I18N);
      s().logEvent('post', m.label, undefined, m.i18n);
    },
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  setLang('en', memoryKV());
  vi.useRealTimers();
});

describe('golden English audit trail', () => {
  it('every label and detail is byte-identical to the pre-i18n capture', () => {
    drive();
    expect(s().events.map((e) => [e.category, e.label, e.detail ?? null])).toEqual(golden);
  });

  it('every event carries a key whose English equals its label (and detail)', () => {
    drive();
    for (const e of s().events) {
      expect(e.key, e.label).toBeTruthy();
      expect(enText(e.key as MessageKey, e.params)).toBe(e.label);
      if (e.detail !== undefined) {
        expect(e.detailKey, `${e.label} detail`).toBeTruthy();
        expect(enText(e.detailKey as MessageKey, e.detailParams)).toBe(e.detail);
      } else {
        expect(e.detailKey).toBeUndefined();
      }
      for (const v of Object.values({ ...e.params, ...e.detailParams })) {
        if (typeof v === 'string') expect(v.startsWith('@') || /^[\d.–\- a-zA-Z/]+$/.test(v), `raw param ${v}`).toBe(true);
      }
    }
  });
});

describe('eventText', () => {
  it('English returns the stored text unchanged', () => {
    drive();
    for (const e of s().events) expect(eventText(e, 'en')).toEqual({ label: e.label, detail: e.detail });
  });

  it('every event renders in Arabic with no leftover {param} or @key', () => {
    drive();
    for (const e of s().events) {
      const r = eventText(e, 'ar');
      expect(r.label).not.toMatch(/[{}@]/);
      if (r.detail) expect(r.detail).not.toMatch(/[{}@]/);
      expect(r.detail === undefined).toBe(e.detail === undefined);
    }
    const shock = s().events.find((e) => e.category === 'shock')!;
    expect(eventText(shock, 'ar').label).toContain('الصدمة');
    const rosc = s().events.find((e) => e.category === 'rosc')!;
    expect(eventText(rosc, 'ar').detail).toContain('06:45');
  });

  it('legacy, unknown-key and unknown-@param events fall back to English', () => {
    const base: CodeEvent = { id: '1', at: 1, t: 1, category: 'system', label: 'Old label', detail: 'Old detail' };
    expect(eventText(base, 'ar')).toEqual({ label: 'Old label', detail: 'Old detail' });
    expect(eventText({ ...base, key: 'ev.fromTheFuture', detailKey: 'nope' }, 'ar')).toEqual({ label: 'Old label', detail: 'Old detail' });
    expect(eventText({ ...base, key: 'ev.causeOn', params: { cause: '@cause.unknown.label' } }, 'ar').label).toBe('Old label');
  });
});

describe('sanitizeSession drops bad translation fields, never the session', () => {
  const ok: CodeEvent = { id: '1', at: 1, t: 0, category: 'system', label: 'CPR paused', key: 'ev.pause' };
  const load = (events: unknown[]) => sanitizeSession({ ...emptySession(), status: 'idle', events });

  it('keeps valid keys and params', () => {
    const e = { ...ok, key: 'ev.cycle', params: { n: 2 }, detail: 'x', detailKey: 'ev.cycle.detail' };
    expect(load([e])!.events[0]).toEqual(e);
  });

  it('removes a malformed key / params from that one event', () => {
    const sess = load([
      { ...ok, key: 42 },
      { ...ok, key: 'ev.cycle', params: 'n=2' },
      { ...ok, key: 'ev.cycle', params: { n: { deep: 1 } } },
      { ...ok, detail: 'd', detailKey: 'ev.x', detailParams: [1] },
      { ...ok, key: 'has space' },
      ok,
    ]);
    expect(sess).not.toBeNull();
    const [a, b, c, d, e, f] = sess!.events;
    expect(a.key).toBeUndefined();
    expect(b.key).toBeUndefined();
    expect(b.params).toBeUndefined();
    expect(c.params).toBeUndefined();
    expect(d.detailKey).toBeUndefined();
    expect(d.detailParams).toBeUndefined();
    expect(d.key).toBe('ev.pause');
    expect(e.key).toBeUndefined();
    expect(f).toEqual(ok);
    expect(sess!.events.every((x) => x.label === 'CPR paused')).toBe(true);
  });

  it('keeps an unknown (newer-app) key: it is displayed as English', () => {
    expect(load([{ ...ok, key: 'ev.someFutureEvent' }])!.events[0].key).toBe('ev.someFutureEvent');
  });
});

describe('post-ROSC checklist across languages', () => {
  it('ticking in Arabic writes the canonical English label; English view and SBAR see it ticked', () => {
    s().reset();
    s().startCode();
    s().declareRosc();
    setLang('ar', memoryKV());
    const m = checklistToggle(s().events, POST_ROSC_PREFIX, ecg, POST_ROSC_CHECKLIST_I18N);
    s().logEvent('post', m.label, undefined, m.i18n);
    const last = s().events[s().events.length - 1];
    expect(last.label).toBe(checklistOnLabel(POST_ROSC_PREFIX, ecg.text));
    expect(last.key).toBe('ev.postRosc.on');
    expect(last.params).toEqual({ item: '@postRosc.ecg' });
    setLang('en', memoryKV());
    expect(isChecklistItemOn(s().events, POST_ROSC_PREFIX, ecg.text)).toBe(true);
    expect(eventText(last, 'ar').label).toContain('ROSC');
  });
});
