import type { CodeEvent } from '../engine/types';
import type { Lang } from './lang';
import type { MessageKey } from './en';
import { canTranslate, translate } from './translate';

export interface DisplayEventText {
  label: string;
  detail?: string;
}

/**
 * Display text for a code event:
 * - English returns the stored label/detail unchanged.
 * - Arabic translates the key, falling back to the stored English if the key is missing
 *   or cannot be translated (e.g. legacy events or unknown params).
 */
export function eventText(e: CodeEvent, lang: Lang): DisplayEventText {
  if (lang === 'en') {
    return { label: e.label, detail: e.detail };
  }

  const label =
    e.key && canTranslate(e.key, e.params)
      ? translate(lang, e.key as MessageKey, e.params)
      : e.label;

  let detail: string | undefined;
  if (e.detail !== undefined) {
    detail =
      e.detailKey && canTranslate(e.detailKey, e.detailParams)
        ? translate(lang, e.detailKey as MessageKey, e.detailParams)
        : e.detail;
  }

  return { label, detail };
}
