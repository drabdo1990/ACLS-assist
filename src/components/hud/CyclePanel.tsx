import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RotateCcw, Timer, Waves } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { useNow } from '../../hooks/useNow';
import {
  CRIT_MS,
  CYCLE_MS,
  cyclePhase,
  cycleProgress,
  cycleRemainingMs,
  formatCountdown,
} from '../../engine/timing';
import { playKlaxon, playWarningChimes } from '../../engine/audio';
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
 * The 2-minute CPR cycle. Cyan → amber (≤ 30 s) → flashing crimson (≤ 10 s, with a
 * 3-chime warning), then a klaxon and a giant "RHYTHM CHECK / SWITCH COMPRESSORS"
 * alert at 00:00. The cycle timer is independent of the master clock, so resetting
 * it never disturbs the arrest duration.
 */
export function CyclePanel() {
  const now = useNow();
  const cyclic = useCodeStore(
    useShallow((s) => ({
      status: s.status,
      cycleIndex: s.cycleIndex,
      pausedAt: s.pausedAt,
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
  const warning = active && !expired && remaining <= CRIT_MS;

  // Each alert fires exactly once per cycle, and re-arms when the cycle is reset.
  const warned = useRef(false);
  const fired = useRef(false);
  useEffect(() => {
    if (warning && !warned.current) {
      warned.current = true;
      playWarningChimes();
      haptic.warn();
    }
    if (!warning && !expired) warned.current = false;
  }, [warning, expired]);
  useEffect(() => {
    if (expired && !fired.current) {
      fired.current = true;
      playKlaxon();
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
      ? 'Cycle complete'
      : 'Cycle remaining';

  return (
    <div
      className={`rounded-2xl border bg-panel/80 p-3 ${
        expired ? 'border-crit' : phase === 'crit' && active ? 'border-crit/70' : phase === 'warn' ? 'border-warn/50' : 'border-line'
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

      {expired ? (
        <div className="animate-flash-bg mb-2 rounded-2xl border-2 border-crit px-3 py-4 text-center text-white">
          <p className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">RHYTHM CHECK</p>
          <p className="text-xl font-black leading-tight tracking-tight sm:text-2xl">SWITCH COMPRESSORS</p>
        </div>
      ) : null}

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
              expired || warning ? 'animate-flash text-crit' : ''
            }`}
            style={{ color: expired || warning ? undefined : color }}
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
          <p className="mb-2 flex items-center justify-center gap-2 text-center text-sm font-bold text-crit">
            <Waves className="h-4 w-4" /> Log the rhythm — resets the cycle
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {RHYTHMS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => resetCycle(r)}
                className="touch-hit min-h-[64px] rounded-xl border border-crit/60 bg-crit/10 text-sm font-bold text-ink active:scale-[0.96]"
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
          'touch-hit tnum flex min-h-[72px] w-full items-center justify-center gap-2 rounded-2xl border text-lg font-bold active:scale-[0.98]',
          phase === 'crit' && active
            ? 'animate-flash-bg border-crit text-white'
            : 'border-cyber/60 bg-cyber/15 text-cyber',
          active ? '' : 'pointer-events-none opacity-40',
        ].join(' ')}
      >
        <RotateCcw className="h-6 w-6" />
        Reset 2-Min Cycle
      </button>
      <p className="mt-1 text-center text-[11px] text-mute">
        Total arrest clock keeps running · cycle length {CYCLE_MS / 1000}s
      </p>
    </div>
  );
}
