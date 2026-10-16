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
