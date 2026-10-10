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
        'text-base font-bold transition-[transform,background-color,border-color,color] duration-100 active:scale-[0.96]',
        selected
          ? 'border-cyber bg-cyber/20 text-cyber'
          : 'border-line bg-panel2 text-ink hover:bg-white/5',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
