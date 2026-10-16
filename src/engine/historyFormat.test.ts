import { describe, expect, it } from 'vitest';
import { computeAggregates } from './history';
import { aggregateRows, medianLabel, recordFlags, recordTitle, UPLOAD_STATUS_LABEL, uploadStatusLabel } from './historyFormat';
import { mkRecord } from './testing/fixtures';

describe('recordTitle / recordFlags', () => {
  it('shows local date-time, outcome and arrest time', () => {
    expect(recordTitle(mkRecord(1), 0)).toBe('2023-11-14 23:13 · ROSC achieved · 10:00');
  });
  it('lists training / void flags', () => {
    expect(recordFlags(mkRecord(1))).toEqual([]);
    expect(recordFlags(mkRecord(1, { training: true, voided: true }))).toEqual(['Training', 'Void']);
  });
  it('has a label for every upload status', () => {
    for (const s of ['local', 'queued', 'sent', 'sent_unconfirmed', 'failed', 'rejected'] as const) {
      expect(UPLOAD_STATUS_LABEL[s]).toBeTruthy();
      expect(uploadStatusLabel(s, 'ar')).toBeTruthy();
    }
  });
  it('supports Arabic for title, flags and upload status', () => {
    expect(recordTitle(mkRecord(1), 0, 'ar')).toBe('2023-11-14 23:13 · تحققت ROSC · \u206610:00\u2069');
    expect(recordFlags(mkRecord(1, { training: true, voided: true }), 'ar')).toEqual(['تدريب', 'ملغى']);
    expect(uploadStatusLabel('sent', 'ar')).toBe('تم الإرسال ✓');
  });
});

describe('aggregateRows', () => {
  const val = (rows: ReturnType<typeof aggregateRows>, label: string) => rows.find((r) => r.label === label)?.value;

  it('empty history: dashes, never NaN or a fake 0%', () => {
    const rows = aggregateRows(computeAggregates([]));
    expect(val(rows, 'Codes counted')).toBe('0');
    expect(val(rows, 'Any ROSC')).toBe('—');
    expect(val(rows, 'Median first epinephrine')).toBe('— (n=0)');
  });

  it('below 5 counted codes: counts, not a percentage; n is shown', () => {
    const rows = aggregateRows(computeAggregates([mkRecord(1), mkRecord(2, {}, { outcome: 'terminated', roscCount: 0 })]));
    expect(val(rows, 'Any ROSC')).toBe('1 of 2');
    expect(val(rows, 'Median first epinephrine')).toBe('02:00 (n=2)');
  });

  it('5 or more: percentage with the fraction', () => {
    const rs = [1, 2, 3, 4, 5].map((n) => mkRecord(n, {}, n <= 2 ? {} : { outcome: 'terminated', roscCount: 0 }));
    expect(val(aggregateRows(computeAggregates(rs)), 'Any ROSC')).toBe('40% (2/5)');
  });

  it('mentions excluded and incomplete codes separately', () => {
    const rows = aggregateRows(
      computeAggregates([mkRecord(1), mkRecord(2, { training: true }), mkRecord(3, {}, { outcome: 'incomplete', roscCount: 0 })]),
    );
    expect(val(rows, 'Codes counted')).toBe('1 · 1 incomplete · 1 training/void');
  });

  it('medianLabel formats value and n', () => {
    expect(medianLabel({ value: 150_000, n: 3 })).toBe('02:30 (n=3)');
    expect(medianLabel({ value: null, n: 0 })).toBe('— (n=0)');
  });

  it('translates aggregate rows to Arabic', () => {
    const rows = aggregateRows(
      computeAggregates([mkRecord(1), mkRecord(2, {}, { outcome: 'terminated', roscCount: 0 })]),
      'ar',
    );
    expect(val(rows, 'النداءات المحتسبة')).toBe('2');
    expect(val(rows, 'أي ROSC')).toBe('1 من 2');
    expect(val(rows, 'وسيط أول إبينفرين')).toBe('\u206602:00\u2069 (n=2)');
  });
});

describe('recordFlags (phase 4a)', () => {
  it('tags pediatric records and keeps training/void flags', () => {
    expect(recordFlags(mkRecord(1), 'en')).toEqual([]);
    expect(recordFlags(mkRecord(2, {}, { population: 'pediatric' }), 'en')).toEqual(['Pediatric']);
    expect(recordFlags(mkRecord(3, { training: true }, { population: 'pediatric' }), 'ar')).toEqual([
      'أطفال',
      'تدريب',
    ]);
  });
});
