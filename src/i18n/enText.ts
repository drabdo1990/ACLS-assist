/**
 * English text for the persisted audit trail. Imports only the English dictionary — no Arabic,
 * no React — so the store's canonical labels never depend on the UI language.
 * (Named `enText`, not `t`, to avoid clashing with the store's local `t` = elapsed time.)
 */
import { EN, type MessageKey } from './en';
import { interpolate, type Params } from './interpolate';
import { formatDuration } from '../engine/timing';
import type { EventI18n, EventParams } from '../engine/types';

const has = (k: string): k is MessageKey => Object.prototype.hasOwnProperty.call(EN, k);

export function enText(key: MessageKey, params?: Params): string {
  return interpolate(EN[key] ?? key, params, (k) => (has(k) ? enText(k) : k), formatDuration);
}

export interface KeyedEvent {
  label: string;
  detail?: string;
  i18n: EventI18n;
}

export function keyed(
  key: MessageKey,
  params?: EventParams,
  detailKey?: MessageKey,
  detailParams?: EventParams,
): KeyedEvent {
  const label = enText(key, params);
  const detail = detailKey ? enText(detailKey, detailParams) : undefined;
  const i18n: EventI18n = { key };
  if (params) i18n.params = params;
  if (detailKey) i18n.detailKey = detailKey;
  if (detailParams) i18n.detailParams = detailParams;
  return { label, detail, i18n };
}
