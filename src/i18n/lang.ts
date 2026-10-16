/**
 * Language choice — stored in `resuscode.lang`, separate from the session, so switching
 * language never touches the code store (no `rev` bump, no session write).
 */
import { browserKV, type KV } from '../engine/kv';

export type Lang = 'en' | 'ar';
export const LANGS: readonly Lang[] = ['en', 'ar'];
export const LANG_KEY = 'resuscode.lang';

export const isLang = (x: unknown): x is Lang => x === 'en' || x === 'ar';
export const dirFor = (lang: Lang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');

/** Arabic only when the browser's first preferred language is Arabic. */
export function detectLang(languages: readonly string[] | null | undefined): Lang {
  const first = languages?.[0];
  return typeof first === 'string' && /^ar(?:-|$)/i.test(first) ? 'ar' : 'en';
}

/** Stored choice when valid, otherwise auto-detected. Never throws. */
export function readLang(kv: KV | null, languages: readonly string[] | null | undefined): Lang {
  try {
    const v = kv?.get(LANG_KEY);
    if (isLang(v)) return v;
  } catch {
    /* unreadable storage → detect */
  }
  return detectLang(languages);
}

function navigatorLanguages(): readonly string[] {
  try {
    if (typeof navigator === 'undefined') return [];
    if (navigator.languages?.length) return navigator.languages;
    return navigator.language ? [navigator.language] : [];
  } catch {
    return [];
  }
}

let current: Lang = readLang(browserKV(), navigatorLanguages());
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function applyDocumentLang(lang: Lang, doc: Document | null = typeof document !== 'undefined' ? document : null): void {
  if (!doc?.documentElement) return;
  doc.documentElement.lang = lang;
  doc.documentElement.dir = dirFor(lang);
}

export function setLang(lang: Lang, kv: KV | null = browserKV()): void {
  if (!isLang(lang)) return;
  try {
    kv?.set(LANG_KEY, lang);
  } catch {
    /* choice lives for this load only */
  }
  if (lang === current) return;
  current = lang;
  applyDocumentLang(lang);
  listeners.forEach((fn) => fn());
}
