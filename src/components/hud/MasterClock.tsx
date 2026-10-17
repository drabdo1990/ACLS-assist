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
  idle: 'text-mute border-line',
  active: 'text-crit border-crit bg-crit/10 animate-pulse',
  paused: 'text-warn border-warn bg-warn/10',
  rosc: 'text-good border-good bg-good/10',
  terminated: 'text-mute border-line',
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
    <div className="flex flex-col items-center gap-1 py-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-mute">
        {t('hud.clock.elapsed')}
      </span>
      <div
        className={[
          'tnum font-mono text-[76px] font-bold leading-none tracking-tight sm:text-[96px]',
          status === 'rosc'
            ? 'text-good'
            : status === 'terminated'
              ? 'text-mute'
              : startedAt == null
                ? 'text-mute/60'
                : 'text-ink',
        ].join(' ')}
        aria-live="off"
        aria-label={`${t('hud.clock.elapsed')} ${formatClock(elapsed)}`}
        dir="ltr"
      >
        {formatClock(elapsed)}
      </div>
      <span className={`rounded-full border px-3 py-0.5 text-xs font-bold tracking-widest ${className}`}>
        {label}
      </span>
      {peds && status !== 'idle' ? (
        <>
          <button
            type="button"
            aria-expanded={editingWeight}
            onClick={() => setEditingWeight((v) => !v)}
            className="mt-0.5 rounded-full border border-peds bg-peds/10 px-3 py-0.5 text-xs font-bold tracking-widest text-peds active:scale-[0.98]"
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
