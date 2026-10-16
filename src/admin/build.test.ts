/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildCode } from '../../scripts/build-apps-script.mjs';

const norm = (s: string) => s.replace(/\r\n/g, '\n');

describe('apps script build', () => {
  const built = buildCode();

  it('the committed Code.gs matches a fresh build (run `npm run build:apps-script`)', () => {
    expect(norm(readFileSync('admin/apps-script/Code.gs', 'utf8'))).toBe(norm(built));
  });

  it('has no ES module syntax and defines the Apps Script entry points', () => {
    expect(built).not.toMatch(/^\s*(export|import)\s/m);
    for (const fn of ['doGet', 'doPost', 'setupAdminSheet', 'handleUpload']) expect(built).toContain(`function ${fn}(`);
  });

  it('evaluates as plain script and the stripped core still works', () => {
    const api = new Function(`${built}\nreturn { handleUpload, DEVICE_COLUMNS };`)() as {
      handleUpload: (body: string, sheet: unknown, now: number) => unknown;
      DEVICE_COLUMNS: string[];
    };
    expect(api.handleUpload('{nope', {}, 0)).toEqual({ ok: false, error: 'schema' });
    expect(api.DEVICE_COLUMNS).toContain('record_id');
  });
});
