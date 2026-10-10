import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface PanelProps {
  title?: ReactNode;
  icon?: LucideIcon;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: 'none' | 'crit' | 'warn' | 'cyber' | 'good';
}

const ACCENT_BORDER: Record<NonNullable<PanelProps['accent']>, string> = {
  none: 'border-line',
  crit: 'border-crit/50',
  warn: 'border-warn/50',
  cyber: 'border-cyber/50',
  good: 'border-good/50',
};

/** Card container used across every workspace. */
export function Panel({ title, icon: Icon, right, children, className = '', accent = 'none' }: PanelProps) {
  return (
    <section
      className={`rounded-2xl border bg-panel/80 p-3 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset] ${ACCENT_BORDER[accent]} ${className}`}
    >
      {title ? (
        <header className="mb-2 flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 text-mute" aria-hidden /> : null}
          <h2 className="text-xs font-bold uppercase tracking-widest text-mute">{title}</h2>
          {right ? <div className="ml-auto">{right}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
