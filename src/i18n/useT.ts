import { useCallback, useSyncExternalStore } from 'react';
import { getLang, subscribeLang, type Lang } from './lang';
import { translate, type Params } from './translate';
import type { MessageKey } from './en';

export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, getLang);
}

export type TFn = (key: MessageKey, params?: Params) => string;

/** `const { t, lang } = useT()` — re-renders the component when the language changes. */
export function useT(): { t: TFn; lang: Lang } {
  const lang = useLang();
  const t = useCallback<TFn>((key, params) => translate(lang, key, params), [lang]);
  return { t, lang };
}
