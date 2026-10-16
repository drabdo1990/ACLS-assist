/**
 * English text for the persisted audit trail. Imports only the English dictionary — no Arabic,
 * no React — so the store's canonical labels never depend on the UI language.
 * (Named `enText`, not `t`, to avoid clashing with the store's local `t` = elapsed time.)
 */
import { EN, type MessageKey } from './en';
import { interpolate, type Params } from './interpolate';
import { formatDuration } from '../engine/timing';

const has = (k: string): k is MessageKey => Object.prototype.hasOwnProperty.call(EN, k);

export function enText(key: MessageKey, params?: Params): string {
  return interpolate(EN[key] ?? key, params, (k) => (has(k) ? enText(k) : k), formatDuration);
}
