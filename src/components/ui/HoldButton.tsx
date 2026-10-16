import { useCallback, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { haptic } from '../../engine/haptics';
import type { ButtonVariant } from './BigButton';
import { useT } from '../../i18n/useT';

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

/**
 * Press-and-hold to confirm — a deliberate gate against accidental taps on
 * irreversible actions (ROSC / terminate) WITHOUT the friction of a modal dialog.
 * A fill sweeps across the button so the user always sees how much longer to hold.
 */
export function HoldButton({
  label,
  sub,
  icon: Icon,
  onComplete,
  durationMs = 1500,
  variant = 'neutral',
  size = 'lg',
  className = '',
  disabled,
  ariaLabel,
}: HoldButtonProps) {
  const { t } = useT();
  const [pct, setPct] = useState(0);
  const raf = useRef<number | null>(null);
  const startedAt = useRef(0);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    if (!fired.current) setPct(0);
  }, []);

  const loop = useCallback(() => {
    const elapsed = performance.now() - startedAt.current;
    const p = Math.min(1, elapsed / durationMs);
    setPct(p);
    if (p >= 1) {
      fired.current = true;
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
      haptic.alarm();
      onComplete();
      // release visual after a beat
      setTimeout(() => {
        fired.current = false;
        setPct(0);
      }, 250);
      return;
    }
    raf.current = requestAnimationFrame(loop);
  }, [durationMs, onComplete]);

  const begin = useCallback(() => {
    if (disabled) return;
    startedAt.current = performance.now();
    fired.current = false;
    raf.current = requestAnimationFrame(loop);
  }, [disabled, loop]);

  const skin = VARIANT_SKIN[variant];
  const height = size === 'xl' ? 'min-h-[84px]' : 'min-h-[64px]';

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? `${label} — ${t('ui.hold.confirm')}`}
      disabled={disabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        begin();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
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
            <span className="text-xs font-medium leading-tight opacity-60">{t('ui.hold.confirm')}</span>
          )}
        </span>
      </span>
    </button>
  );
}
