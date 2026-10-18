import type { ReactNode } from 'react';

export interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/** Large selectable pill — used for weights, joules, rhythm, and filters. */
export function Chip({ selected, onClick, children, className = '', ariaLabel }: ChipProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onClick}
      className={[
        'touch-hit tnum flex min-h-[56px] min-w-[64px] items-center justify-center rounded-xl border px-4',
        'text-base font-bold transition-[transform,background-color,border-color,color,box-shadow] duration-100 active:scale-[0.96]',
        selected
          ? 'border-cyber bg-cyber/20 text-cyber shadow-[0_0_12px_rgba(6,182,212,0.22)_inset,0_1px_4px_rgba(0,0,0,0.3)]'
          : 'border-line/90 bg-panel2/85 text-ink shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] hover:border-line-bright hover:bg-panel3/70',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
