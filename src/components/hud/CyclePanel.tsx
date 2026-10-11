import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RotateCcw, Timer, Waves } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import {
  CYCLE_MS,
  cyclePhase,
  cycleProgress,
  cycleRemainingMs,
  formatCountdown,
} from '../../engine/timing';
import { playCycleAlarm } from '../../engine/audio';
import { haptic } from '../../engine/haptics';
import type { RhythmLoop } from '../../engine/types';

const R = 108;
const C = 2 * Math.PI * R;

const PHASE_COLOR: Record<string, string> = {
  cruise: '#06b6d4',
  warn: '#f59e0b',
  crit: '#ef4444',
};

const RHYTHMS: RhythmLoop[] = ['VF', 'pVT', 'PEA', 'Asystole', 'Pulse'];

/**
 * The 2-minute CPR cycle. Cyan → amber → flashing red, with an audible alarm and
 * a rhythm-check prompt at expiry. The cycle timer is independent of the master
 * clock, so resetting it never disturbs the arrest duration.
 */
export function CyclePanel() {
  const now = useNow();
  const cyclic = useCodeStore(
    useShallow((s) => ({
      status: s.status,
      cycleIndex: s.cycleIndex,
      startedAt: s.startedAt,
      pausedAt: s.pausedAt,
      pausedAccumMs: s.pausedAccumMs,
      cycleStartedAt: s.cycleStartedAt,
      cyclePausedAccumMs: s.cyclePausedAccumMs,
    })),
  );
  const resetCycle = useCodeStore((s) => s.resetCycle);

  const remaining = cycleRemainingMs(cyclic, now);
  const phase = cyclePhase(remaining);
  const progress = cycleProgress(remaining);
  const active = cyclic.status === 'active';
  const expired = active && remaining <= 0;

  // Fire the alarm exactly once per expiry, then re-arm after a reset.
  const fired = useRef(false);
  useEffect(() => {
    if (expired && !fired.current) {
      fired.current = true;
      playCycleAlarm();
      haptic.alarm();
    }
    if (!expired) fired.current = false;
  }, [expired]);

  const color = PHASE_COLOR[phase];
  const arcLen = C * (1 - progress);

  const label = !active
    ? cyclic.status === 'idle'
      ? 'Awaiting start'
      : 'Cycle stopped'
    : expired
      ? 'CHANGE / RHYTHM CHECK'
      : 'Cycle remaining';

  return (
    <div
      className={`rounded-2xl border bg-panel/80 p-3 ${
        expired ? 'border-crit' : phase === 'warn' ? 'border-warn/50' : 'border-line'
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-mute">
          <Timer className="h-4 w-4" /> 2-min CPR cycle
        </span>
        <span className="tnum rounded-full border border-line px-2 py-0.5 text-xs font-bold text-mute">
          Cycle {cyclic.cycleIndex}
        </span>
      </div>

      <div className="relative mx-auto flex h-[236px] w-[236px] items-center justify-center">
        <svg viewBox="0 0 260 260" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="130" cy="130" r={R} fill="none" stroke="#131c2c" strokeWidth="18" />
          <circle
            cx="130"
            cy="130"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${C}`}
            style={{ transition: 'stroke 300ms linear' }}
          />
        </svg>
        <div className="flex flex-col items-center">
          <span
            className={`tnum font-mono text-6xl font-bold leading-none ${
              expired ? 'animate-flash text-crit' : ''
            }`}
            style={{ color: expired ? undefined : color }}
          >
            {formatCountdown(remaining)}
          </span>
          <span
            className={`mt-1 max-w-[170px] text-center text-[11px] font-bold uppercase tracking-wider ${
              expired ? 'animate-flash text-crit' : 'text-mute'
            }`}
          >
            {label}
          </span>
        </div>
      </div>

      {expired ? (
        <div className="mb-2 rounded-xl border border-crit p-2">
          <p className="mb-2 flex items-center gap-2 text-center text-sm font-bold text-crit">
            <Waves className="h-4 w-4" /> Check rhythm — log it and reset the cycle
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {RHYTHMS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => resetCycle(r)}
                className="touch-hit min-h-[56px] rounded-xl border border-crit/60 bg-crit/10 text-sm font-bold text-ink active:scale-[0.96]"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => resetCycle()}
        disabled={!active}
        className={[
          'touch-hit tnum flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl border text-lg font-bold active:scale-[0.98]',
          phase === 'crit' && active
            ? 'animate-flash-bg border-crit text-white'
            : 'border-cyber/60 bg-cyber/15 text-cyber',
          active ? '' : 'pointer-events-none opacity-40',
        ].join(' ')}
      >
        <RotateCcw className="h-6 w-6" />
        Reset cycle to 02:00
      </button>
      <p className="mt-1 text-center text-[11px] text-mute">
        Master arrest clock keeps running · cycle length {CYCLE_MS / 1000}s
      </p>
    </div>
  );
}
