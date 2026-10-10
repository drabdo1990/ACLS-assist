import { useState, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export interface CrisisCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: 'crit' | 'warn' | 'cyber' | 'good';
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

const ACCENT: Record<CrisisCardProps['accent'], { border: string; text: string; bg: string }> = {
  crit: { border: 'border-crit/60', text: 'text-crit', bg: 'bg-crit/10' },
  warn: { border: 'border-warn/60', text: 'text-warn', bg: 'bg-warn/10' },
  cyber: { border: 'border-cyber/60', text: 'text-cyber', bg: 'bg-cyber/10' },
  good: { border: 'border-good/60', text: 'text-good', bg: 'bg-good/10' },
};

/** Single-tap expandable crisis algorithm card. One level deep — never a nested menu. */
export function CrisisCard({
  title,
  subtitle,
  icon: Icon,
  accent,
  badge,
  defaultOpen = false,
  children,
}: CrisisCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const a = ACCENT[accent];

  return (
    <section className={`overflow-hidden rounded-2xl border bg-panel/80 ${a.border}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="touch-hit flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left active:scale-[0.99]"
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${a.border} ${a.bg}`}>
          <Icon className={`h-6 w-6 ${a.text}`} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-base font-bold leading-tight ${a.text}`}>{title}</span>
          <span className="block text-xs leading-tight text-mute">{subtitle}</span>
        </span>
        {badge}
        <ChevronDown
          className={`h-6 w-6 shrink-0 text-mute transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className={`border-t ${a.border} p-3`}>{children}</div> : null}
    </section>
  );
}

/** A numeric readout tile used inside crisis calculators. */
export function Readout({
  label,
  value,
  unit,
  tone = 'ink',
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: 'ink' | 'crit' | 'warn' | 'cyber' | 'good';
}) {
  const toneClass =
    tone === 'crit'
      ? 'text-crit'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'cyber'
          ? 'text-cyber'
          : tone === 'good'
            ? 'text-good'
            : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-panel2 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-mute">{label}</div>
      <div className={`tnum font-mono text-xl font-bold leading-tight ${toneClass}`}>
        {value}
        {unit ? <span className="ml-1 text-xs font-semibold text-mute">{unit}</span> : null}
      </div>
    </div>
  );
}
