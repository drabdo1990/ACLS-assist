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
  none: 'border-line/90',
  crit: 'border-crit/55 shadow-[0_0_18px_rgba(239,68,68,0.12)]',
  warn: 'border-warn/55 shadow-[0_0_18px_rgba(245,158,11,0.12)]',
  cyber: 'border-cyber/55 shadow-[0_0_18px_rgba(6,182,212,0.12)]',
  good: 'border-good/55 shadow-[0_0_18px_rgba(16,185,129,0.12)]',
};

/** Card container used across every workspace. */
export function Panel({ title, icon: Icon, right, children, className = '', accent = 'none' }: PanelProps) {
  return (
    <section
      className={`surface-card rounded-2xl border p-3.5 backdrop-blur-sm ${ACCENT_BORDER[accent]} ${className}`}
    >
      {title ? (
        <header className="mb-2.5 flex items-center gap-2 border-b border-line/50 pb-2">
          {Icon ? <Icon className="h-4 w-4 text-cyber/85" aria-hidden /> : null}
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-mute">{title}</h2>
          {right ? <div className="ms-auto">{right}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
