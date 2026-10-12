import { useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import { formatClock, masterElapsedMs } from '../../engine/timing';
import type { SessionStatus } from '../../engine/types';

const STATUS_STYLE: Record<SessionStatus, { label: string; className: string }> = {
  idle: { label: 'STANDBY', className: 'text-mute border-line' },
  active: { label: 'ACTIVE ARREST', className: 'text-crit border-crit bg-crit/10 animate-pulse' },
  paused: { label: 'ACTIVE ARREST · PAUSED', className: 'text-warn border-warn bg-warn/10' },
  rosc: { label: 'ROSC ACHIEVED', className: 'text-good border-good bg-good/10' },
  terminated: { label: 'TERMINATED', className: 'text-mute border-line' },
};

/**
 * The master code clock. Giant monospace tabular digits so the readout never
 * shifts width as the seconds tick — critical when read from across the room.
 */
export function MasterClock() {
  const now = useNow();
  const startedAt = useCodeStore((s) => s.startedAt);
  const pausedAt = useCodeStore((s) => s.pausedAt);
  const pausedAccumMs = useCodeStore((s) => s.pausedAccumMs);
  const status = useCodeStore((s) => s.status);

  const elapsed = masterElapsedMs({ startedAt, pausedAt, pausedAccumMs }, now);
  const pill = STATUS_STYLE[status];

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-mute">
        Total Arrest Time
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
        aria-label={`Elapsed ${formatClock(elapsed)}`}
      >
        {formatClock(elapsed)}
      </div>
      <span className={`rounded-full border px-3 py-0.5 text-xs font-bold tracking-widest ${pill.className}`}>
        {pill.label}
      </span>
    </div>
  );
}
