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
  enqueueOrRevert,
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

describe('enqueueOrRevert', () => {
  it('puts the record back to local when the outbox cannot be saved, so Backfill can retry it', () => {
    const kv = enrolledKV();
    const rec = queued(kv, 1).record;
    const realSet = kv.set;
    kv.set = (k, v) => (k === OUTBOX_KEY ? false : realSet(k, v)); // storage refuses the outbox only
    expect(enqueueOrRevert(kv, rec, pl(1), T0, loadPrefs(kv).retention)).toBe(false);
    expect(statusOf(kv, 1)).toBe('local');
    expect(backfillCandidates(kv).map((r) => r.id)).toContain(rec.id);
  });

  it('leaves the record queued when the outbox saves', () => {
    const kv = enrolledKV();
    const rec = queued(kv, 1).record;
    expect(enqueueOrRevert(kv, rec, pl(1), T0, loadPrefs(kv).retention)).toBe(true);
    expect(statusOf(kv, 1)).toBe('queued');
  });
});

describe('entry age', () => {
  const DAY = 86_400_000;

  it('drops an entry stuck for over 30 days back to local, without sending it', async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    const f = fakeFetch(json({ ok: true }));
    await flushOutbox(mk(kv, f, () => T0 + 31 * DAY));
    expect(f.calls).toHaveLength(0);
    expect(Object.keys(loadOutbox(kv).entries)).toHaveLength(0);
    expect(statusOf(kv, 1)).toBe('local');
  });

  it('keeps and sends an entry saved before queuedAt existed, starting its clock now', async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    const state = JSON.parse(kv.get(OUTBOX_KEY)!);
    delete state.entries[mkRecord(1).id].queuedAt;
    kv.set(OUTBOX_KEY, JSON.stringify(state));
    const f = fakeFetch(json({ ok: true }));
    await flushOutbox(mk(kv, f, () => T0 + 31 * DAY));
    expect(f.calls).toHaveLength(1);
    expect(statusOf(kv, 1)).toBe('sent');
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

  it('stops the flush after a connectivity failure instead of trying every other record', async () => {
    const kv = enrolledKV();
    for (const n of [1, 2, 3]) {
      queued(kv, n);
      enqueue(kv, pl(n), T0);
    }
    const f = fakeFetch(html());
    const s = await flushOutbox(mk(kv, f));
    expect(f.calls).toHaveLength(1);
    expect(s.failed).toBe(1);
  });

  it("a record the script cannot store ('server' reply) does not block the others, and is dropped after 20 tries", async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    queued(kv, 2);
    enqueue(kv, pl(2), T0);
    const f = fakeFetch(json({ ok: false, error: 'server' }), json({ ok: true }));
    const s = await flushOutbox(mk(kv, f));
    expect(s).toMatchObject({ failed: 1, sent: 1 });
    expect(statusOf(kv, 2)).toBe('sent');
    for (let i = 1; i < 20; i++) await flushOutbox(mk(kv, fakeFetch(json({ ok: false, error: 'server' })), () => T0 + i * 600_000));
    expect(statusOf(kv, 1)).toBe('rejected');
    expect(loadOutbox(kv).entries[mkRecord(1).id]).toBeUndefined();
  });

  it('offline failures never reach the retry cap', async () => {
    const kv = enrolledKV();
    queued(kv, 1);
    enqueue(kv, pl(1), T0);
    for (let i = 0; i < 30; i++) await flushOutbox(mk(kv, fakeFetch(html()), () => T0 + i * 600_000));
    expect(statusOf(kv, 1)).toBe('failed');
    expect(loadOutbox(kv).entries[mkRecord(1).id]).toBeDefined();
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
