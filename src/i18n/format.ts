import { formatClock, formatDuration } from '../engine/timing';
import type { Lang } from './lang';

/** Durations: "6m 45s" in English; clock format in Arabic (avoids Arabic plural forms). */
export function formatDurationFor(lang: Lang, ms: number): string {
  return lang === 'ar' ? formatClock(ms) : formatDuration(ms);
}

/**
 * The single date formatter: always Gregorian calendar and Western digits, whatever the
 * device locale (an ar-SA phone would otherwise give a Hijri date with Arabic-Indic digits).
 * `base` overrides the locale tag (tests, or a regional variant).
 */
export function formatDateTime(ms: number, lang: Lang, base?: string): string {
  const tag = `${base ?? (lang === 'ar' ? 'ar' : 'en')}-u-ca-gregory-nu-latn`;
  try {
    return new Intl.DateTimeFormat(tag, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      calendar: 'gregory',
      numberingSystem: 'latn',
    }).format(ms);
  } catch {
    return new Date(ms).toISOString();
  }
}

export const LRI = '\u2066';
export const PDI = '\u2069';
/** Left-to-right isolate for plain text (times / brackets inside Arabic). */
export const ltr = (s: string): string => `${LRI}${s}${PDI}`;
