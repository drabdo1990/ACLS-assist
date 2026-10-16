import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCodeStore } from '../../engine/store';
import type { EventCategory } from '../../engine/types';
import {
  checklistOffLabel,
  checklistOnLabel,
  checklistToggle,
  isChecklistItemOn,
  POST_ROSC_CHECKLIST_I18N,
} from '../../engine/checklist';
import { POST_ROSC_PREFIX } from '../../engine/eventQueries';

export interface ChecklistItemLike {
  id: string;
  text: string;
  critical?: boolean;
}

/**
 * Checked state derived from the persisted event log, so ticks survive tab switches
 * and refreshes. Unticking logs an explicit "unchecked" entry rather than erasing history.
 */
export function useLoggedChecklist(category: EventCategory, prefix: string) {
  const events = useCodeStore((s) => s.events);
  const logEvent = useCodeStore((s) => s.logEvent);

  const isOn = (text: string) => isChecklistItemOn(events, prefix, text);

  const toggle = (item: ChecklistItemLike | string) => {
    if (typeof item === 'string') {
      logEvent(category, isOn(item) ? checklistOffLabel(prefix, item) : checklistOnLabel(prefix, item));
    } else if (prefix === POST_ROSC_PREFIX) {
      const res = checklistToggle(events, prefix, item, POST_ROSC_CHECKLIST_I18N);
      logEvent(category, res.label, undefined, res.i18n);
    } else {
      logEvent(category, isOn(item.text) ? checklistOffLabel(prefix, item.text) : checklistOnLabel(prefix, item.text));
    }
  };

  return { isOn, toggle };
}

/** Interactive protocol checklist. Checking an item stamps it into the event log/SBAR. */
export function Checklist({
  items,
  category,
  prefix,
  icon: Icon,
}: {
  items: ChecklistItemLike[];
  category: EventCategory;
  prefix: string;
  icon?: LucideIcon;
}) {
  const { isOn, toggle } = useLoggedChecklist(category, prefix);

  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const on = isOn(item.text);
        return (
          <li key={item.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item)}
              className={[
                'touch-hit flex min-h-[64px] w-full items-center gap-3 rounded-xl border px-3 text-left active:scale-[0.98]',
                on ? 'border-good bg-good/10' : item.critical ? 'border-crit/50 bg-crit/5' : 'border-line bg-panel2',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                  on ? 'border-good bg-good text-bg' : 'border-line',
                ].join(' ')}
              >
                {on ? <Check className="h-4 w-4" strokeWidth={3} /> : Icon ? <Icon className="h-4 w-4 text-mute" /> : null}
              </span>
              <span
                className={`text-sm leading-tight ${on ? 'text-good' : item.critical ? 'font-bold text-ink' : 'text-ink'}`}
              >
                {item.text}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
