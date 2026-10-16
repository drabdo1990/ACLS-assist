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
