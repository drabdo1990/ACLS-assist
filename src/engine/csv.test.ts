import { describe, it, expect } from 'vitest';
import { csvCell, csvFilename, recordsToCsv } from './csv';
import { mkRecord } from './testing/fixtures';

describe('csvCell', () => {
  it('quotes commas, quotes, CR and LF per RFC 4180', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
    expect(csvCell('plain')).toBe('plain');
  });
  it('renders null as empty, booleans as TRUE/FALSE, numbers as-is', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(true)).toBe('TRUE');
    expect(csvCell(false)).toBe('FALSE');
    expect(csvCell(-5)).toBe('-5');
  });
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])('neutralises leading %j', (s) => {
    expect(csvCell(s).replace(/^"/, '').startsWith("'")).toBe(true);
  });
});

describe('recordsToCsv', () => {
  it('starts with a UTF-8 BOM and uses CRLF', () => {
    const out = recordsToCsv([mkRecord(1)], 0);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.split('\r\n')).toHaveLength(2);
  });
  it('has one header per value and flattens a record', () => {
    const [head, row] = recordsToCsv([mkRecord(1, { unit: 'ICU', training: true })], 0).slice(1).split('\r\n');
    const cols = head.split(',');
    const vals = row.split(',');
    expect(vals.length).toBe(cols.length);
    expect(vals[cols.indexOf('unit')]).toBe('ICU');
    expect(vals[cols.indexOf('training')]).toBe('TRUE');
    expect(vals[cols.indexOf('outcome')]).toBe('rosc');
    expect(vals[cols.indexOf('arrest_s')]).toBe('600');
    expect(vals[cols.indexOf('start_iso')]).toBe('2023-11-14T23:13:20+00:00');
  });
  it('keeps Arabic text and neutralises an injected unit name', () => {
    const out = recordsToCsv([mkRecord(1, { unit: '=HYPERLINK("x")' }), mkRecord(2, { unit: 'العناية' })], 0);
    expect(out).toContain('العناية');
    expect(out).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('empty history is just the header row', () => {
    expect(recordsToCsv([], 0).slice(1).split('\r\n')).toHaveLength(1);
  });
  it('filename is dated', () => {
    expect(csvFilename(Date.UTC(2026, 9, 16, 8, 5))).toMatch(/^resuscode-history-\d{8}\.csv$/);
  });
});
