import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The real Apps Script adapter (`makeAdapter_` in the generated Code.gs) run against a tiny in-memory
 * spreadsheet: row finding, the free-row scan past pre-formatted admin cells, and "admin cells keep their value".
 */
type Grid = unknown[][];

function fakeSheet(grid: Grid, maxRows: number) {
  const sheet = {
    maxRows,
    insertCalls: 0,
    getLastColumn: () => Math.max(0, ...grid.map((r) => r.length)),
    getMaxRows: () => sheet.maxRows,
    insertRowsAfter: (_after: number, n: number) => {
      sheet.insertCalls += 1;
      sheet.maxRows += n;
    },
    getRange: (row: number, col: number, nr = 1, nc = 1) => ({
      getValues: () =>
        Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => grid[row - 1 + i]?.[col - 1 + j] ?? '')),
      getValue: () => grid[row - 1]?.[col - 1] ?? '',
      setValues: (v: unknown[][]) =>
        v.forEach((r, i) =>
          r.forEach((x, j) => {
            (grid[row - 1 + i] ??= [])[col - 1 + j] = x;
          }),
        ),
    }),
  };
  return sheet;
}

function load(codes: ReturnType<typeof fakeSheet>, cache = new Map<string, string>()) {
  const ss = { getSheetByName: (n: string) => (n === 'Codes' ? codes : null), insertSheet: () => codes };
  const CacheService = {
    getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => void cache.set(k, v) }),
  };
  const src = readFileSync('admin/apps-script/Code.gs', 'utf8');
  const api = new Function('CacheService', 'console', `${src}\nreturn { makeAdapter_ };`)(CacheService, console) as {
    makeAdapter_: (ss: unknown) => {
      readHeaders(): string[];
      findRow(h: string, v: string): number | null;
      readCell(row: number, h: string): unknown;
      appendRow(c: Record<string, unknown>): void;
      updateCells(row: number, c: Record<string, unknown>): void;
      countUpload(unit: string, hour: number): number;
    };
  };
  return api.makeAdapter_(ss);
}

// Header + two pre-formatted admin rows (blank record_id, `reviewed` checkbox already FALSE).
const fresh = (): Grid => [
  ['record_id', 'unit', 'outcome', 'reviewed'],
  ['', '', '', false],
  ['', '', '', false],
];

describe('Apps Script adapter', () => {
  it('appends into the first free row, keeps the admin checkbox, and finds/updates rows by record_id', () => {
    const grid = fresh();
    const a = load(fakeSheet(grid, 3));
    a.appendRow({ record_id: 'R1', unit: 'ICU', outcome: 'rosc' });
    a.appendRow({ record_id: 'R2', unit: 'ICU', outcome: 'rosc' });
    expect(grid[1]).toEqual(['R1', 'ICU', 'rosc', false]);
    expect(grid[2]).toEqual(['R2', 'ICU', 'rosc', false]);

    expect(a.findRow('record_id', 'R2')).toBe(3);
    expect(a.findRow('record_id', 'nope')).toBeNull();
    a.updateCells(3, { outcome: 'terminated' });
    expect(grid[2]).toEqual(['R2', 'ICU', 'terminated', false]);
    expect(a.readCell(3, 'outcome')).toBe('terminated');
    expect(a.readCell(3, 'no_such_column')).toBeNull();
  });

  it('adds rows when the sheet is full instead of overwriting', () => {
    const grid = fresh();
    const sheet = fakeSheet(grid, 3);
    const a = load(sheet);
    for (const id of ['R1', 'R2', 'R3']) a.appendRow({ record_id: id, unit: 'ICU' });
    expect(sheet.insertCalls).toBe(1);
    expect(grid[3][0]).toBe('R3');
    expect(grid[1][0]).toBe('R1');
  });

  it('counts uploads per unit and hour bucket', () => {
    const a = load(fakeSheet(fresh(), 3));
    expect([a.countUpload('ICU', 5), a.countUpload('ICU', 5), a.countUpload('Ward', 5), a.countUpload('ICU', 6)]).toEqual([1, 2, 1, 1]);
  });
});
