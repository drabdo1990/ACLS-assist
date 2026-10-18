import { useState } from 'react';
import { useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import { formatClock, masterElapsedMs } from '../../engine/timing';
import type { SessionStatus } from '../../engine/types';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/en';
import { PEDIATRIC_CLINICAL_REVIEWED } from '../../content/profiles';
import { WeightCard } from './WeightCard';

const STATUS_CLASS: Record<SessionStatus, string> = {
  idle: 'text-mute border-line/90 bg-panel2/60',
  active: 'text-crit border-crit/80 bg-crit/12 shadow-[0_0_12px_rgba(239,68,68,0.2)_inset] animate-pulse',
  paused: 'text-warn border-warn/80 bg-warn/12 shadow-[0_0_12px_rgba(245,158,11,0.18)_inset]',
  rosc: 'text-good border-good/80 bg-good/12 shadow-[0_0_12px_rgba(16,185,129,0.2)_inset]',
  terminated: 'text-mute border-line/90 bg-panel2/60',
};

const STATUS_DOT: Record<SessionStatus, string> = {
  idle: 'bg-mute/60',
  active: 'bg-crit shadow-[0_0_6px_#ef4444]',
  paused: 'bg-warn shadow-[0_0_6px_#f59e0b]',
  rosc: 'bg-good shadow-[0_0_6px_#10b981]',
  terminated: 'bg-mute/50',
};

const STATUS_KEY: Record<SessionStatus, MessageKey> = {
  idle: 'hud.clock.status.standby',
  active: 'hud.clock.status.active',
  paused: 'hud.clock.status.paused',
  rosc: 'hud.clock.status.rosc',
  terminated: 'hud.clock.status.terminated',
};

/**
 * The master code clock. Giant monospace tabular digits so the readout never
 * shifts width as the seconds tick — critical when read from across the room.
 */
export function MasterClock() {
  const { t } = useT();
  const now = useNow();
  const startedAt = useCodeStore((s) => s.startedAt);
  const endedAt = useCodeStore((s) => s.endedAt);
  const roscAccumMs = useCodeStore((s) => s.roscAccumMs);
  const status = useCodeStore((s) => s.status);
  const population = useCodeStore((s) => s.population);
  const weightKg = useCodeStore((s) => s.weightKg);
  const weightSource = useCodeStore((s) => s.weightSource);
  const [editingWeight, setEditingWeight] = useState(false);

  const elapsed = masterElapsedMs({ startedAt, endedAt, roscAccumMs }, now);
  const className = STATUS_CLASS[status];
  const label = t(STATUS_KEY[status]);

  const peds = population === 'pediatric';
  const badgeKey: MessageKey =
    weightKg == null ? 'peds.badge.noWeight' : weightSource === 'estimated' ? 'peds.badge.estimated' : 'peds.badge.measured';

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-line/70 bg-gradient-to-b from-[#070c18] to-[#040710] px-3 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.45)_inset]">
      <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-mute">
        {t('hud.clock.elapsed')}
      </span>
      <div
        className={[
          'tnum font-mono text-[76px] font-bold leading-none tracking-tight sm:text-[96px]',
          status === 'rosc'
            ? 'text-good drop-shadow-[0_0_16px_rgba(16,185,129,0.28)]'
            : status === 'terminated'
              ? 'text-mute'
              : startedAt == null
                ? 'text-mute/55'
                : 'text-ink drop-shadow-[0_0_14px_rgba(240,244,253,0.14)]',
        ].join(' ')}
        aria-live="off"
        aria-label={`${t('hud.clock.elapsed')} ${formatClock(elapsed)}`}
        dir="ltr"
      >
        {formatClock(elapsed)}
      </div>
      <span className={`flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-bold tracking-widest ${className}`}>
        <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
        {label}
      </span>
      {peds && status !== 'idle' ? (
        <>
          <button
            type="button"
            aria-expanded={editingWeight}
            onClick={() => setEditingWeight((v) => !v)}
            className="mt-0.5 rounded-full border border-peds/80 bg-peds/12 px-3.5 py-0.5 text-xs font-bold tracking-widest text-peds shadow-[0_0_10px_rgba(139,92,246,0.18)_inset] active:scale-[0.98]"
          >
            {t(badgeKey, weightKg != null ? { kg: weightKg } : undefined)}
          </button>
          {!PEDIATRIC_CLINICAL_REVIEWED ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-warn">
              {t('peds.previewNotice')}
            </span>
          ) : null}
          {editingWeight ? (
            <div className="mt-1 w-full text-start">
              <WeightCard />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
