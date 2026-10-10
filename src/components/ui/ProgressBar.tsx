export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  className?: string;
  barClassName?: string;
  height?: string;
}

export function ProgressBar({ value, className = '', barClassName = '', height = 'h-3' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-black/50 ring-1 ring-inset ring-white/5 ${height} ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className={`h-full rounded-full transition-[width,background-color] duration-200 ease-linear ${barClassName}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
