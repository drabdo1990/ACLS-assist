import { useMemo, useState } from 'react';
import {
  Activity,
  Check,
  HeartPulse,
  Radio,
  RotateCcw,
  Siren,
  ScanLine,
  Search,
  Syringe,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import { formatClock, formatWallClock } from '../../engine/timing';
import type { EventCategory } from '../../engine/types';

import { eventText } from '../../i18n/eventText';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/en';

const CATEGORY: Record<EventCategory, { icon: LucideIcon; className: string }> = {
  system: { icon: Siren, className: 'text-mute border-line' },
  cycle: { icon: RotateCcw, className: 'text-cyber border-cyber/50' },
  cpr: { icon: HeartPulse, className: 'text-crit border-crit/50' },
  airway: { icon: Wind, className: 'text-cyber border-cyber/50' },
  drug: { icon: Syringe, className: 'text-warn border-warn/50' },
  shock: { icon: Zap, className: 'text-crit border-crit/50' },
  rhythm: { icon: Activity, className: 'text-good border-good/50' },
  cause: { icon: Search, className: 'text-warn border-warn/50' },
  pocus: { icon: ScanLine, className: 'text-cyber border-cyber/50' },
  rosc: { icon: Radio, className: 'text-good border-good/50' },
  post: { icon: Check, className: 'text-good border-good/50' },
};

const FILTERS: Array<{ id: 'all' | EventCategory; labelKey: MessageKey }> = [
  { id: 'all', labelKey: 'timeline.all' },
  { id: 'drug', labelKey: 'timeline.drugs' },
  { id: 'shock', labelKey: 'timeline.shocks' },
  { id: 'cycle', labelKey: 'timeline.cycles' },
  { id: 'rhythm', labelKey: 'timeline.rhythm' },
  { id: 'airway', labelKey: 'timeline.airway' },
  { id: 'cause', labelKey: 'timeline.causes' },
];

/** Chronological event timeline (newest first) with category filtering. */
export function Timeline() {
  const { t, lang } = useT();
  const events = useCodeStore((s) => s.events);
  const [filter, setFilter] = useState<'all' | EventCategory>('all');
  const [ascending, setAscending] = useState(false);

  const shown = useMemo(() => {
    const list = filter === 'all' ? events : events.filter((e) => e.category === filter);
    const copy = [...list];
    copy.sort((a, b) => (ascending ? a.at - b.at : b.at - a.at));
    return copy;
  }, [events, filter, ascending]);

  return (
    <div className="flex flex-col gap-2">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={[
              'touch-hit shrink-0 rounded-full border px-4 py-2 text-sm font-bold',
              filter === f.id ? 'border-cyber bg-cyber/20 text-cyber' : 'border-line bg-panel2 text-mute',
            ].join(' ')}
          >
            {t(f.labelKey)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAscending((v) => !v)}
          className="touch-hit ml-auto shrink-0 rounded-full border border-line bg-panel2 px-4 py-2 text-sm font-bold text-mute"
        >
          {ascending ? t('timeline.oldestFirst') : t('timeline.newestFirst')}
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-mute">{t('timeline.empty')}</p>
      ) : (
        <ol className="space-y-1.5">
          {shown.map((e) => {
            const c = CATEGORY[e.category];
            const Icon = c.icon;
            const item = eventText(e, lang);
            return (
              <li key={e.id} className={`flex items-start gap-3 rounded-xl border bg-panel2/60 p-3 ${c.className}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${c.className}`}>
                  <Icon className="h-5 w-5" strokeWidth={2.3} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="tnum font-mono text-sm font-bold text-ink" dir="ltr">{formatClock(e.t)}</span>
                    <span className="tnum font-mono text-[11px] text-mute" dir="ltr">{formatWallClock(e.at)}</span>
                    <span className="text-sm font-semibold text-ink">{item.label}</span>
                  </div>
                  {item.detail ? <p className="text-xs leading-snug text-mute">{item.detail}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
