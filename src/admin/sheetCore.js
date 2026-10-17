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
  'population', 'weight_kg', 'weight_source',
  'ended_epoch_ms', 'arrest_ms', 'rosc_count', 'first_rosc_ms', 'first_shock_ms', 'first_epi_ms',
  'branch_at_first_epi', 'shock_count', 'shock_joules', 'epi_count', 'epi_mean_interval_ms',
  'epi_longest_interval_ms', 'epi_interval_flag', 'amiodarone_count', 'amiodarone_mg', 'lidocaine_count',
  'magnesium_count', 'cycles', 'paused_ms', 'airway_type', 'airway_first_ms', 'rhythms', 'causes', 'pocus',
  'post_rosc_done', 'post_rosc_total', 'sbar', 'payload_version', 'stats_version', 'last_upload_iso',
];

/**
 * Device columns an existing sheet's header row lacks (e.g. the phase 4a population / weight columns),
 * in canonical order. `setupAdminSheet` appends them so Dashboard formulas can reference every column
 * on a sheet created by an older script; existing columns and rows are never moved.
 */
export function missingDeviceColumns(headers) {
  return DEVICE_COLUMNS.filter(function (c) {
    return headers.indexOf(c) < 0;
  });
}

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
    // Phase 4a: a payload with no population (older app) reads as adult.
    population: st.population === 'pediatric' ? 'pediatric' : 'adult',
    weight_kg: val(st.weightKg),
    weight_source: val(st.weightSource),
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
  else {
    // A key may only update rows its own unit wrote (record ids are guessable: start time + device id).
    const owner = sheet.readCell(row, 'unit');
    if (owner != null && String(owner) !== '' && String(owner) !== unit.name) return { ok: false, error: 'key' };
    sheet.updateCells(row, cells);
  }
  return { ok: true };
}
