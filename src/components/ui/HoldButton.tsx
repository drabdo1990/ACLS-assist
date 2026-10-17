import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { haptic } from '../../engine/haptics';
import type { ButtonVariant } from './BigButton';
import { useT } from '../../i18n/useT';
import {
  HOLD_DEFAULT_MS,
  HOLD_RELEASE_MS,
  cancelHold,
  idleHold,
  isHoldKey,
  releaseHold,
  startHold,
  tickHold,
  type HoldState,
} from './holdLogic';

const VARIANT_SKIN: Record<ButtonVariant, { base: string; fill: string }> = {
  neutral: { base: 'border-line text-ink', fill: 'bg-white/10' },
  primary: { base: 'border-cyber/60 text-cyber', fill: 'bg-cyber/30' },
  cyber: { base: 'border-cyber/60 text-cyber', fill: 'bg-cyber/30' },
  crit: { base: 'border-crit text-crit', fill: 'bg-crit/40' },
  warn: { base: 'border-warn/70 text-warn', fill: 'bg-warn/40' },
  good: { base: 'border-good/70 text-good', fill: 'bg-good/40' },
  outline: { base: 'border-line text-ink', fill: 'bg-white/10' },
};

export interface HoldButtonProps {
  label: string;
  sub?: string;
  icon?: LucideIcon;
  onComplete: () => void;
  /** hold duration in ms before the action fires (default 1.5 s) */
  durationMs?: number;
  variant?: ButtonVariant;
  size?: 'lg' | 'xl';
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

type HoldSource = 'pointer' | 'key';

/**
 * Press-and-hold to confirm — a deliberate gate against accidental taps on
 * irreversible actions (ROSC / terminate) WITHOUT the friction of a modal dialog.
 * A fill sweeps across the button so the user always sees how much longer to hold.
 *
 * Pointer press and keyboard press (Space / Enter) drive the same pure state machine
 * (`holdLogic`), so a keyboard hold needs exactly the same full duration. A quick
 * keypress or release/blur before the duration cancels.
 */
export function HoldButton({
  label,
  sub,
  icon: Icon,
  onComplete,
  durationMs = HOLD_DEFAULT_MS,
  variant = 'neutral',
  size = 'lg',
  className = '',
  disabled,
  ariaLabel,
}: HoldButtonProps) {
  const { t } = useT();
  const hintId = useId();
  const [pct, setPct] = useState(0);
  const raf = useRef<number | null>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = useRef<HoldState>(idleHold());
  const source = useRef<HoldSource | null>(null);
  const mounted = useRef(true);

  // Always read the latest props from the running rAF loop (no stale closures).
  const onCompleteRef = useRef(onComplete);
  const durationRef = useRef(durationMs);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    durationRef.current = durationMs;
  }, [onComplete, durationMs]);

  const stopFrame = useCallback(() => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    stopFrame();
    const next = cancelHold(hold.current);
    if (next !== hold.current) {
      hold.current = next;
      source.current = null;
      setPct(0);
    }
  }, [stopFrame]);

  const loop = useCallback(() => {
    raf.current = null;
    if (!mounted.current) return;
    const r = tickHold(hold.current, performance.now(), durationRef.current);
    hold.current = r.state;
    setPct(r.progress);
    if (r.complete) {
      source.current = null;
      haptic.alarm();
      onCompleteRef.current();
      // release visual after a beat
      releaseTimer.current = setTimeout(() => {
        releaseTimer.current = null;
        hold.current = releaseHold(hold.current);
        setPct(0);
      }, HOLD_RELEASE_MS);
      return;
    }
    raf.current = requestAnimationFrame(loop);
  }, []);

  const begin = useCallback(
    (from: HoldSource) => {
      if (disabled) return;
      const next = startHold(hold.current, performance.now());
      if (next === hold.current) return; // a hold is already counting
      if (releaseTimer.current != null) {
        clearTimeout(releaseTimer.current);
        releaseTimer.current = null;
      }
      hold.current = next;
      source.current = from;
      raf.current = requestAnimationFrame(loop);
    },
    [disabled, loop],
  );

  // Unmounting mid-hold must stop the rAF loop and the release timer and never call onComplete.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
      if (releaseTimer.current != null) clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
      hold.current = idleHold();
    };
  }, []);

  // Becoming disabled mid-hold abandons the hold.
  useEffect(() => {
    if (disabled) cancel();
  }, [disabled, cancel]);

  const skin = VARIANT_SKIN[variant];
  const height = size === 'xl' ? 'min-h-[84px]' : 'min-h-[64px]';

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      aria-describedby={hintId}
      disabled={disabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        begin('pointer');
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onKeyDown={(e) => {
        if (!isHoldKey(e.key)) return;
        e.preventDefault(); // Space must not scroll; Enter must not synthesize a click
        if (e.repeat) return; // auto-repeat must not restart or extend the hold
        begin('key');
      }}
      onKeyUp={(e) => {
        if (!isHoldKey(e.key)) return;
        e.preventDefault();
        if (source.current === 'key') cancel();
      }}
      onBlur={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={[
        'touch-hit relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-4 text-start',
        'transition-[transform] duration-100 active:scale-[0.98]',
        height,
        skin.base,
        disabled ? 'pointer-events-none opacity-40' : '',
        className,
      ].join(' ')}
    >
      <span id={hintId} className="sr-only">
        {t('ui.hold.confirm')}
      </span>
      <span
        aria-hidden
        className={`absolute inset-y-0 start-0 ${skin.fill} transition-none`}
        style={{ width: `${pct * 100}%` }}
      />
      <span className="relative flex w-full items-center gap-3">
        {Icon ? <Icon className="h-7 w-7 shrink-0" strokeWidth={2.4} aria-hidden /> : null}
        <span className="flex min-w-0 flex-col">
          <span className="text-lg font-bold leading-tight">{label}</span>
          {sub ? (
            <span className="text-xs font-medium leading-tight opacity-80">{sub}</span>
          ) : (
            <span aria-hidden className="text-xs font-medium leading-tight opacity-60">
              {t('ui.hold.confirm')}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
