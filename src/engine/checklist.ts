import type { CodeEvent, EventI18n } from './types';

/**
 * Logged-checklist helpers. A checklist item's state is never stored on its own: it is
 * replayed from the event log (check = `<prefix>: text`, uncheck = `<prefix> (unchecked): text`),
 * so it survives refresh and the SBAR export reads the same truth as the UI.
 */
export const checklistOnLabel = (prefix: string, text: string) => `${prefix}: ${text}`;
export const checklistOffLabel = (prefix: string, text: string) => `${prefix} (unchecked): ${text}`;

/** Whether an item is currently checked, replaying the log in order. */
export function isChecklistItemOn(events: CodeEvent[], prefix: string, text: string): boolean {
  const on = checklistOnLabel(prefix, text);
  const off = checklistOffLabel(prefix, text);
  let state = false;
  for (const e of events) {
    if (e.label === on) state = true;
    else if (e.label === off) state = false;
  }
  return state;
}

export interface ChecklistI18nConfig {
  onKey: string;
  offKey: string;
  itemKey: (id: string) => string;
}

export const POST_ROSC_CHECKLIST_I18N: ChecklistI18nConfig = {
  onKey: 'ev.postRosc.on',
  offKey: 'ev.postRosc.off',
  itemKey: (id) => `postRosc.${id}`,
};

export function checklistToggle(
  events: CodeEvent[],
  prefix: string,
  item: { id: string; text: string },
  i18n?: ChecklistI18nConfig,
): { label: string; i18n?: EventI18n } {
  const on = isChecklistItemOn(events, prefix, item.text);
  const label = on ? checklistOffLabel(prefix, item.text) : checklistOnLabel(prefix, item.text);
  if (!i18n) return { label };
  const key = on ? i18n.offKey : i18n.onKey;
  return {
    label,
    i18n: {
      key,
      params: { item: `@${i18n.itemKey(item.id)}` },
    },
  };
}
