/** Reads the one-time `#enroll=<code>` fragment of an enrollment link. */
import { parseEnrollmentCode, type Enrollment } from './prefs';

export type EnrollFragment = { kind: 'none' } | { kind: 'invalid' } | { kind: 'ok'; enrollment: Enrollment };

export function readEnrollFragment(hash: string): EnrollFragment {
  if (!/(^|[#&])enroll=/.test(hash)) return { kind: 'none' };
  const enrollment = parseEnrollmentCode(hash.replace(/^#/, ''));
  return enrollment ? { kind: 'ok', enrollment } : { kind: 'invalid' };
}

/**
 * Called ONCE from main.tsx before render (React StrictMode runs initialisers twice, so reading
 * in a component would lose the fragment). The fragment is removed from the address bar on every path.
 */
export function takeEnrollFragment(): EnrollFragment {
  if (typeof window === 'undefined') return { kind: 'none' };
  const result = readEnrollFragment(window.location.hash);
  if (result.kind !== 'none') {
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      /* best effort */
    }
  }
  return result;
}
