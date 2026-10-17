import { describe, expect, it } from 'vitest';
import { buildPayload, buildTestPayload } from '../engine/upload';
import { DEVICE, T0, mkRecord } from '../engine/testing/fixtures';
import {
  ADMIN_COLUMNS,
  DEVICE_COLUMNS,
  MAX_CELL_CHARS,
  handleUpload,
  missingDeviceColumns,
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
    readCell: (row, h) => (headers.includes(h) ? rows[row - 2][h] ?? '' : null),
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

  it("refuses to update a row another unit's key wrote, and leaves it untouched", () => {
    const s = memorySheet();
    send(s, P()); // ICU writes the row
    const wardKey = buildPayload(mkRecord(1, { training: true }), { enrollmentKey: 'unit-ward-2026', offsetMin: 0 });
    expect(send(s, wardKey)).toEqual({ ok: false, error: 'key' });
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({ unit: 'ICU', training: false });
    expect(send(s, P({}))).toEqual({ ok: true }); // the owning unit can still update
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

describe('missingDeviceColumns — setup on an existing (pre-4a) sheet', () => {
  it('lists the device columns an older sheet lacks, in canonical order', () => {
    const old = DEVICE_COLUMNS.filter((c) => !['population', 'weight_kg', 'weight_source'].includes(c));
    expect(missingDeviceColumns([...old, ...ADMIN_COLUMNS])).toEqual(['population', 'weight_kg', 'weight_source']);
  });

  it('is empty for a current sheet and for a fresh header row', () => {
    expect(missingDeviceColumns([...DEVICE_COLUMNS, ...ADMIN_COLUMNS])).toEqual([]);
    expect(missingDeviceColumns([...DEVICE_COLUMNS])).toEqual([]);
  });

  it('wants every device column when the sheet has no header yet', () => {
    expect(missingDeviceColumns([])).toEqual(DEVICE_COLUMNS);
  });

  it('never proposes an admin column (the script must not write those)', () => {
    expect(missingDeviceColumns(['record_id'])).not.toContain('reviewed');
  });
});

describe('population / weight columns (phase 4a)', () => {
  it('a payload with population and weight fields writes them', () => {
    const s = memorySheet();
    const rec = mkRecord(1, {}, { population: 'pediatric', weightKg: 18, weightSource: 'estimated' });
    expect(send(s, buildPayload(rec, { enrollmentKey: KEY, offsetMin: 0 }))).toEqual({ ok: true });
    expect(s.rows[0]).toMatchObject({ population: 'pediatric', weight_kg: 18, weight_source: 'estimated' });
  });

  it('a payload without the new fields (older app) reads as adult with empty weight', () => {
    const s = memorySheet();
    expect(send(s, P())).toEqual({ ok: true });
    expect(s.rows[0]).toMatchObject({ population: 'adult', weight_kg: null, weight_source: null });
  });

  it('the new columns are appended to an old sheet by header name; admin columns untouched', () => {
    const oldHeaders = DEVICE_COLUMNS.filter((c) => !['population', 'weight_kg', 'weight_source'].includes(c));
    const s = memorySheet([...oldHeaders, 'debrief_note'], [{ record_id: `${T0}-${DEVICE}`, debrief_note: 'keep me' }]);
    expect(send(s, P())).toEqual({ ok: true });
    expect(s.headers).toContain('population');
    expect(s.headers).toContain('weight_kg');
    expect(s.headers).toContain('weight_source');
    // the pre-existing row is untouched (it reads as adult at filter time); the new row lands below it
    expect(s.rows[0].population).toBeUndefined();
    expect(s.rows[0].debrief_note).toBe('keep me');
    expect(s.rows[1].population).toBe('adult');
  });
});
