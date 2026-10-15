import type { CodeEvent } from './types';

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
