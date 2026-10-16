/**
 * English messages — the reference language and the source of `MessageKey`.
 *
 * Clinical content (causes, POCUS, post-ROSC bundle) is NOT duplicated here: its keys are
 * generated from the content data, so the English has one source of truth.
 */
import { CAUSES } from '../content/causes';
import { POCUS_ITEMS } from '../content/pocus';
import { POST_ROSC_BUNDLE, type PostRoscId } from '../content/protocols';
import type { CauseId, PocusId } from '../engine/types';

const UI = {
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.ar': 'العربية',
  'i18n.draftNotice': 'Arabic clinical text is a draft awaiting clinician review — English is the reference.',
} as const;

type CauseKey = `cause.${CauseId}.${'label' | 'clue' | 'action'}`;
type PocusKey = `pocus.${PocusId}.${'view' | 'label' | 'meaning'}`;
type PostRoscKey = `postRosc.${PostRoscId}`;
type ContentKey = CauseKey | PocusKey | PostRoscKey;

export type MessageKey = keyof typeof UI | ContentKey;

function contentMessages(): Record<ContentKey, string> {
  const out: Record<string, string> = {};
  for (const c of CAUSES) {
    out[`cause.${c.id}.label`] = c.label;
    out[`cause.${c.id}.clue`] = c.clue;
    out[`cause.${c.id}.action`] = c.action;
  }
  for (const p of POCUS_ITEMS) {
    out[`pocus.${p.id}.view`] = p.view;
    out[`pocus.${p.id}.label`] = p.label;
    out[`pocus.${p.id}.meaning`] = p.meaning;
  }
  for (const i of POST_ROSC_BUNDLE) out[`postRosc.${i.id}`] = i.text;
  return out as Record<ContentKey, string>;
}

export const EN: Readonly<Record<MessageKey, string>> = { ...UI, ...contentMessages() };
