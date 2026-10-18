import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type ButtonVariant =
  | 'neutral'
  | 'primary'
  | 'crit'
  | 'warn'
  | 'good'
  | 'cyber'
  | 'outline';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  neutral:
    'bg-gradient-to-b from-panel3/85 to-panel2 border-line/95 text-ink shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_3px_8px_rgba(0,0,0,0.32)] hover:border-line-bright',
  primary:
    'bg-gradient-to-b from-cyber/25 to-cyber/12 border-cyber/70 text-cyber shadow-[0_0_14px_rgba(6,182,212,0.16)_inset,0_3px_8px_rgba(0,0,0,0.28)] hover:from-cyber/32 hover:to-cyber/18',
  crit: 'bg-gradient-to-b from-[#f44343] to-[#dc2626] text-white border-crit shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset,0_4px_14px_rgba(239,68,68,0.35)] hover:from-[#f85252] hover:to-[#e12e2e]',
  warn: 'bg-gradient-to-b from-warn/25 to-warn/12 border-warn/70 text-warn shadow-[0_0_14px_rgba(245,158,11,0.16)_inset,0_3px_8px_rgba(0,0,0,0.28)] hover:from-warn/32 hover:to-warn/18',
  good: 'bg-gradient-to-b from-good/25 to-good/12 border-good/70 text-good shadow-[0_0_14px_rgba(16,185,129,0.16)_inset,0_3px_8px_rgba(0,0,0,0.28)] hover:from-good/32 hover:to-good/18',
  cyber:
    'bg-gradient-to-b from-cyber/25 to-cyber/12 border-cyber/70 text-cyber shadow-[0_0_14px_rgba(6,182,212,0.16)_inset,0_3px_8px_rgba(0,0,0,0.28)] hover:from-cyber/32 hover:to-cyber/18',
  outline:
    'bg-panel/60 border-line/90 text-ink shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] hover:border-line-bright hover:bg-panel2/60',
};

export interface BigButtonProps {
  label: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  variant?: ButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** 'lg' = 64px min height (default), 'xl' = 84px for the highest-stakes controls */
  size?: 'lg' | 'xl';
  full?: boolean;
  ariaLabel?: string;
}

/**
 * Massive, high-contrast tap target (≥64 px). Built for gloved hands under load:
 * generous padding, no hover-only affordances, and an unmistakable pressed state.
 */
export function BigButton({
  label,
  sub,
  icon: Icon,
  variant = 'neutral',
  onClick,
  disabled,
  className = '',
  size = 'lg',
  full,
  ariaLabel,
}: BigButtonProps) {
  const height = size === 'xl' ? 'min-h-[84px]' : 'min-h-[64px]';
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={[
        'touch-hit select-none relative flex w-full items-center gap-3 rounded-2xl border px-4 text-start',
        'transition-[transform,background-color,opacity] duration-100 active:scale-[0.97]',
        height,
        VARIANT_CLASS[variant],
        disabled ? 'pointer-events-none opacity-40' : '',
        full ? 'col-span-full' : '',
        className,
      ].join(' ')}
    >
      {Icon ? <Icon className="h-7 w-7 shrink-0" strokeWidth={2.4} aria-hidden /> : null}
      <span className="flex min-w-0 flex-col">
        <span className="text-lg font-bold leading-tight">{label}</span>
        {sub ? <span className="text-xs font-medium leading-tight opacity-80">{sub}</span> : null}
      </span>
    </button>
  );
}
