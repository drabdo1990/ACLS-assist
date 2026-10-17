export type RejectCode = 'size' | 'version' | 'schema' | 'key';
export type UploadResult = { ok: true } | { ok: false; error: RejectCode };

export interface UnitRow {
  key: unknown;
  unit: unknown;
  /** boolean true or the string "TRUE" (case-insensitive) means active */
  active: unknown;
}

export interface SheetAdapter {
  readHeaders(): string[];
  addHeaders(names: string[]): void;
  /** 1-based sheet row number of the first data row whose `header` cell equals `value`, or null */
  findRow(header: string, value: string): number | null;
  /** value of the `header` column on 1-based sheet row `row`, or null when there is no such column */
  readCell(row: number, header: string): unknown;
  appendRow(cells: Record<string, unknown>): void;
  updateCells(row: number, cells: Record<string, unknown>): void;
  readUnits(): UnitRow[];
}

export const PAYLOAD_VERSION: 1;
export const MAX_BODY_CHARS: number;
export const MAX_CELL_CHARS: number;
export const RECORD_ID_RE: RegExp;
export const DEVICE_ID_RE: RegExp;
export const DEVICE_COLUMNS: string[];
export const ADMIN_COLUMNS: string[];
export const ISSUE_CATEGORIES: string[];
export const ACTION_STATUSES: string[];

export function missingDeviceColumns(headers: string[]): string[];
export function neutralise<T>(v: T): T | string;
export function validatePayload(p: unknown): 'version' | 'schema' | null;
export function findActiveUnit(units: UnitRow[], key: string): { name: string } | null;
export function flattenPayload(p: Record<string, any>, unitName: string, nowIso: string): Record<string, unknown>;
export function handleUpload(body: string, sheet: SheetAdapter, nowMs: number): UploadResult;
