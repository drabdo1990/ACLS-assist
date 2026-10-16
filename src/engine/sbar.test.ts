import { describe, it, expect } from 'vitest';
import { buildSbar, sbarFilename, type SbarInput } from './sbar';
import type { CodeEvent } from './types';
import { formatWallClock } from './timing';
import { POST_ROSC_BUNDLE } from '../content/protocols';
import { statsRows } from './statsFormat';
import { computeCodeStats } from './stats';
import { mkStats } from './testing/fixtures';

const T0 = 1_700_000_000_000;

function ev(
  t: number,
  category: CodeEvent['category'],
  label: string,
  detail?: string,
  i18n?: { key?: string; params?: Record<string, string | number>; detailKey?: string; detailParams?: Record<string, string | number> },
): CodeEvent {
  return { id: `${t}-${label}`, at: T0 + t, t, category, label, detail, ...i18n };
}

const base: SbarInput = {
  status: 'rosc',
  startedAt: T0,
  endedAt: T0 + 405_000,
  roscAccumMs: 0,
  events: [
    ev(0, 'system', 'Code Blue activated', undefined, { key: 'ev.start' }),
    ev(45_000, 'shock', 'Defibrillation: Shock #1 (200J Biphasic)', undefined, {
      key: 'ev.shock',
      params: { n: 1, joules: 200, waveform: '@waveform.biphasic' },
    }),
    ev(70_000, 'drug', 'Epinephrine 1 mg IV/IO', 'Dose #1 · repeat every 3–5 min', {
      key: 'ev.epi',
      detailKey: 'ev.epi.detail',
      detailParams: { n: 1 },
    }),
    ev(120_000, 'cycle', 'Cycle 1 completed', 'Rhythm: VF · switch compressors', {
      key: 'ev.cycle',
      params: { n: 1 },
      detailKey: 'ev.cycle.detailRhythm',
      detailParams: { rhythm: 'VF' },
    }),
    ev(120_000, 'rhythm', 'Rhythm check — VF', undefined, { key: 'ev.rhythmCheck', params: { rhythm: 'VF' } }),
    ev(160_000, 'airway', 'Advanced airway placed — ETT', undefined, {
      key: 'ev.airway',
      params: { airway: '@airway.ETT' },
    }),
    ev(260_000, 'drug', 'Amiodarone 300 mg IV/IO', 'First dose', {
      key: 'ev.amio',
      params: { mg: 300 },
      detailKey: 'ev.dose.first',
    }),
    ev(405_000, 'rosc', 'ROSC declared', 'Total arrest duration: 6m 45s. Total shocks: 1. Total epi: 1 mg.', {
      key: 'ev.rosc',
      detailKey: 'ev.rosc.detail',
      detailParams: { durationMs: 405_000, shocks: 1, epiMg: 1 },
    }),
  ],
  shocks: [{ at: T0 + 45_000, t: 45_000, joules: 200, shockable: true, waveform: 'biphasic' }],
  epi: [{ at: T0 + 70_000, t: 70_000, label: 'Epinephrine 1 mg IV/IO', mg: 1 }],
  amio: [{ at: T0 + 260_000, t: 260_000, label: 'Amiodarone 300 mg IV/IO', mg: 300 }],
  lido: [],
  rhythmBranch: 'shockable',
  airwayPlaced: true,
  airwayType: 'ETT',
  causes: { hypoxia: true, thrombosis_coronary: true },
  pocus: { effusion: false, rv_strain: true },
  weightKg: 70,
};

describe('buildSbar', () => {
  const text = buildSbar(base, T0 + 500_000);

  it('is titled ResusCode, PHI-free, and states the outcome', () => {
    expect(text).toContain('ResusCode — RESUSCITATION SUMMARY');
    expect(text).toContain('PHI-free');
    expect(text).toContain('Outcome: ROSC achieved');
  });

  it('reports total arrest time frozen at ROSC', () => {
    expect(text).toContain('Total arrest time: 06:45 (6m 45s)');
  });

  it('summarises branch, airway, shocks and doses', () => {
    expect(text).toContain('Rhythm branch: Shockable (VF / pulseless VT)');
    expect(text).toContain('Advanced airway: ETT placed');
    expect(text).toContain('Shocks delivered: 1');
    expect(text).toContain('Epinephrine: 1 dose (total 1 mg)');
    expect(text).toContain('Amiodarone doses: 1 (300 mg)');
    expect(text).toContain('Lidocaine doses: 0');
    expect(text).toContain('Defibrillation energies: 200J Biphasic');
  });

  it('lists rhythms, causes and POCUS findings', () => {
    expect(text).toContain('Rhythms documented: VF');
    expect(text).toContain('Reversible causes addressed: Hypoxia, Thrombosis (coronary)');
    expect(text).toContain('POCUS findings: RV dilatation / strain');
  });

  it('recommends the SHA post-ROSC bundle after ROSC', () => {
    expect(text).toContain('Post-ROSC bundle');
    expect(text).toContain('Cath Lab');
    expect(text).toContain('dopamine 5–10 mcg/kg/min');
    expect(text).toContain('32–37.5 °C for 12–24 h');
    expect(text).toContain('SHA ACLS 2024');
  });

  it('includes a bracketed, chronological timeline', () => {
    expect(text).toContain(`[00:00] ${formatWallClock(T0)}  Code Blue activated`);
    expect(text).toContain(`[00:45] ${formatWallClock(T0 + 45_000)}  Defibrillation: Shock #1 (200J Biphasic)`);
    expect(text).toContain(`[06:45] ${formatWallClock(T0 + 405_000)}  ROSC declared`);
    expect(text.indexOf('Shock #1 (200J')).toBeLessThan(text.indexOf('[01:10]'));
  });

  it('handles an empty session gracefully', () => {
    const empty = buildSbar({ ...base, events: [], status: 'idle', startedAt: null, endedAt: null }, T0);
    expect(empty).toContain('(no events)');
    expect(empty).toContain('Outcome: No cardiac arrest recorded');
    expect(empty).not.toContain('Post-ROSC bundle');
  });

  it('does not recommend post-ROSC care for a terminated code', () => {
    const ended = buildSbar({ ...base, status: 'terminated' }, T0 + 500_000);
    expect(ended).toContain('Outcome: Resuscitation terminated');
    expect(ended).not.toContain('Post-ROSC bundle');
  });
});

describe('post-ROSC care section', () => {
  const [first, second] = POST_ROSC_BUNDLE;

  it('lists completed vs not-yet-recorded bundle items after ROSC', () => {
    const events = [
      ...base.events,
      ev(410_000, 'post', `Post-ROSC: ${first.text}`),
      ev(420_000, 'post', `Post-ROSC: ${second.text}`),
      ev(430_000, 'post', `Post-ROSC (unchecked): ${second.text}`),
    ];
    const text = buildSbar({ ...base, events }, T0 + 500_000);
    expect(text).toContain('=== POST-ROSC CARE ===');
    expect(text).toContain(`Completed (1/${POST_ROSC_BUNDLE.length}):`);
    expect(text).toContain(`[x] ${first.text}`);
    expect(text).toContain(`[ ] ${second.text}`); // un-ticked again, so pending
  });

  it('says nothing was recorded when no item is ticked', () => {
    const text = buildSbar(base, T0 + 500_000);
    expect(text).toContain('(none recorded)');
  });

  it('is omitted when ROSC never occurred (no misleading "all pending" list)', () => {
    const events = base.events.filter((e) => e.category !== 'rosc');
    const text = buildSbar({ ...base, status: 'terminated', events }, T0 + 500_000);
    expect(text).not.toContain('POST-ROSC CARE');
  });
});

describe('sbarFilename', () => {
  it('is filename-safe and ends with .txt', () => {
    expect(sbarFilename(T0)).toMatch(/^resuscode-sbar-\d{8}-\d{4}\.txt$/);
  });
});

describe('CODE STATISTICS section', () => {
  it('is omitted without stats and matches statsRows line-for-line when present', () => {
    expect(buildSbar(base, T0 + 500_000)).not.toContain('=== CODE STATISTICS ===');
    const stats = computeCodeStats({ ...base, pausedAt: base.endedAt, pausedAccumMs: 0, population: 'adult', weightSource: null, ageMonths: null }, T0 + 500_000)!;
    const text = buildSbar({ ...base, stats, training: true }, T0 + 500_000);
    expect(text).toContain('=== CODE STATISTICS ===');
    expect(text).toContain('TRAINING / SIMULATION');
    expect(text).toContain('Times are from code activation, as logged.');
    for (const r of statsRows(stats)) expect(text).toContain(`${r.label}: ${r.value}`);
  });
});

describe('buildSbar relativeOnly (upload variant)', () => {
  const T = 1_700_000_000_000;
  const input = {
    status: 'rosc' as const,
    startedAt: T,
    endedAt: T + 300_000,
    roscAccumMs: 0,
    events: [
      { id: '1', at: T, t: 0, category: 'system' as const, label: 'Code Blue activated' },
      { id: '2', at: T + 300_000, t: 300_000, category: 'rosc' as const, label: 'ROSC declared', detail: 'Total arrest duration: 5m 0s.' },
    ],
    shocks: [],
    epi: [],
    amio: [],
    lido: [],
    rhythmBranch: null,
    airwayPlaced: false,
    airwayType: null,
    causes: {},
    pocus: {},
    weightKg: 70,
  };
  it('has no Generated line and no wall-clock timestamps', () => {
    const out = buildSbar(input, T + 400_000, { relativeOnly: true });
    expect(out).not.toContain('Generated:');
    expect(out).not.toContain(formatWallClock(T));
    expect(out).not.toContain(formatWallClock(T + 300_000));
    expect(out).toContain('[00:00]');
    expect(out).toContain('[05:00]');
    expect(out).toContain('ROSC achieved at [05:00].');
  });
  it('default output is unchanged (still has Generated and wall-clock)', () => {
    const out = buildSbar(input, T + 400_000);
    expect(out).toContain('Generated:');
    expect(out).toContain(formatWallClock(T));
  });
  it('does not vary with the training / void flags: they are separate sheet columns, so toggling one must not rewrite the SBAR cell', () => {
    const withStats = { ...input, stats: mkStats({ startedAt: T }) };
    const a = buildSbar({ ...withStats, training: false, voided: false }, T + 400_000, { relativeOnly: true });
    const b = buildSbar({ ...withStats, training: true, voided: true }, T + 400_000, { relativeOnly: true });
    expect(b).toBe(a);
    expect(a).not.toContain('TRAINING / SIMULATION');
    // the on-screen / pasted SBAR still shows the flags
    expect(buildSbar({ ...withStats, training: true }, T + 400_000)).toContain('TRAINING / SIMULATION');
    expect(buildSbar({ ...withStats, voided: true }, T + 400_000)).toContain('VOIDED');
  });
});

describe('golden English SBAR comparison & Arabic SBAR', () => {
  const [first, second] = POST_ROSC_BUNDLE;
  const allEvents = [
    ...base.events,
    ev(410_000, 'post', `Post-ROSC: ${first.text}`),
    ev(420_000, 'post', `Post-ROSC: ${second.text}`),
    ev(430_000, 'post', `Post-ROSC (unchecked): ${second.text}`),
  ];
  const fullSession: SbarInput = {
    ...base,
    events: allEvents,
    stats: computeCodeStats(
      { ...base, events: allEvents, pausedAt: base.endedAt, pausedAccumMs: 0, population: 'adult', weightSource: null, ageMonths: null },
      T0 + 500_000,
    ),
    training: true,
  };

  it('English SBAR output is byte-identical to golden copy (ignoring Generated line)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    // Normalise CRLF (Windows checkouts) — the golden content itself is LF.
    const golden = fs.readFileSync(path.resolve('src/engine/testing/goldenSbar.txt'), 'utf8').replace(/\r\n/g, '\n');

    const actual = buildSbar(fullSession, T0 + 500_000, { lang: 'en' });
    const actualWithoutGenerated = actual
      .split('\n')
      .filter((l) => !l.startsWith('Generated:'))
      .join('\n');

    expect(actualWithoutGenerated).toBe(golden);
  });

  it('Arabic SBAR has Arabic section headings, translated events and LRI-wrapped timestamps', () => {
    const arText = buildSbar(fullSession, T0 + 500_000, { lang: 'ar' });

    // Section headings
    expect(arText).toContain('=== الوضع ===');
    expect(arText).toContain('=== الخلفية ===');
    expect(arText).toContain('=== التقييم ===');
    expect(arText).toContain('=== إحصاءات النداء ===');
    expect(arText).toContain('=== رعاية ما بعد ROSC ===');
    expect(arText).toContain('=== التوصيات ===');
    expect(arText).toContain('=== التسلسل الزمني ===');

    // Title and outcome
    expect(arText).toContain('ResusCode — ملخص الإنعاش');
    expect(arText).toContain('النتيجة: تحققت ROSC');
    expect(arText).toContain('إجمالي مدة التوقف: \u206606:45\u2069');

    // LRI-wrapped times
    expect(arText).toContain('\u2066[00:00]\u2069');
    expect(arText).toContain('\u2066[00:45]\u2069');
    expect(arText).toContain('\u2066[06:45]\u2069');

    // Translated events
    expect(arText).toContain('تفعيل نداء الإنعاش (Code Blue)');
    expect(arText).toContain('إزالة الرجفان: الصدمة رقم 1 (200J ثنائية الطور)');
    expect(arText).toContain('إعلان عودة الدورة الدموية التلقائية (ROSC)');
  });
});

describe('pediatric SBAR (phase 4a)', () => {
  const pedsBase: SbarInput = {
    ...base,
    population: 'pediatric',
    weightKg: 16,
    weightSource: 'estimated',
    ageMonths: 48,
    epi: [{ at: T0 + 60_000, t: 60_000, label: 'Epinephrine 0.16 mg IV/IO', mg: 0.16 }],
    amio: [{ at: T0 + 90_000, t: 90_000, label: 'Amiodarone 80 mg IV/IO', mg: 80 }],
  };

  it('pediatric situation line plus weight line; adult line absent', () => {
    const out = buildSbar(pedsBase, T0 + 500_000);
    expect(out).toContain('Pediatric in-hospital cardiac arrest — PALS (SHA).');
    expect(out).toContain('Weight ≈16 kg (estimated from age 4 y).');
    expect(out).not.toContain('Adult in-hospital cardiac arrest');
  });

  it('background lists doses in mg with the mg/kg rule', () => {
    const out = buildSbar(pedsBase, T0 + 500_000);
    expect(out).toContain('Epinephrine: 1 × 0.01 mg/kg (0.16 mg)');
    expect(out).toContain('Amiodarone: 1 × 5 mg/kg (80 mg)');
  });

  it('pediatric recommendations replace the adult post-ROSC lines', () => {
    const out = buildSbar(pedsBase, T0 + 500_000);
    expect(out).toContain('- SpO₂ 94–99% — avoid hyperoxia; normal CO₂.');
    expect(out).toContain('- Avoid hypotension (SBP < 5th centile for age)');
    expect(out).not.toContain('- Post-ROSC bundle: secure airway (ETT)');
  });

  it('unweighted pediatric code marks doses not calculated', () => {
    const out = buildSbar(
      {
        ...pedsBase,
        weightKg: null,
        weightSource: null,
        ageMonths: null,
        epi: [{ at: T0 + 60_000, t: 60_000, label: 'Epinephrine given — dose not calculated (no weight)', mg: null }],
        amio: [],
      },
      T0 + 500_000,
    );
    expect(out).toContain('Weight not set — doses not calculated.');
    expect(out).toContain('(doses not calculated)');
  });

  it('Arabic pediatric SBAR translates the situation, weight and recommendations', () => {
    const out = buildSbar(pedsBase, T0 + 500_000, { lang: 'ar' });
    expect(out).toContain('توقف قلبي داخل المستشفى لدى طفل — وفق بروتوكول PALS (SHA)');
    expect(out).toContain('الوزن ≈16 kg (تقديري من العمر 4 y)');
    expect(out).toContain('Epinephrine: 1 × 0.01 mg/kg (0.16 mg)');
  });
});
