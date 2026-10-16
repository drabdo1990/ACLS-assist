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
  neutral: 'bg-panel2 border-line text-ink hover:bg-[#1a2434]',
  primary: 'bg-cyber/15 border-cyber/60 text-cyber hover:bg-cyber/25',
  crit: 'bg-crit text-white border-crit hover:bg-[#f05252] shadow-[0_0_0_1px_rgba(239,68,68,0.4)]',
  warn: 'bg-warn/15 border-warn/60 text-warn hover:bg-warn/25',
  good: 'bg-good/15 border-good/60 text-good hover:bg-good/25',
  cyber: 'bg-cyber/15 border-cyber/60 text-cyber hover:bg-cyber/25',
  outline: 'bg-transparent border-line text-ink hover:bg-white/5',
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
