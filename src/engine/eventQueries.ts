import type { AirwayType, CodeEvent, RhythmBranch } from './types';

/**
 * Canonical (English) event labels that logic depends on. Labels are part of the persisted
 * audit trail, so these strings must never change once shipped.
 */
export const BRANCH_EVENT_PREFIX = 'Rhythm branch: ';
export const RHYTHM_CHECK_PREFIX = 'Rhythm check — ';
export const AIRWAY_EVENT_PREFIX = 'Advanced airway placed';
export const SGA_LABEL = 'Supraglottic airway';
export const MAGNESIUM_PREFIX = 'Magnesium';
export const POST_ROSC_PREFIX = 'Post-ROSC';
export const ROSC_LABEL = 'ROSC declared';
export const REARREST_LABEL = 'Re-arrest';
export const CODE_ENDED_LABEL = 'Code ended';

/** Branch implied by the most recent branch event. */
export function branchFromEvents(events: CodeEvent[]): RhythmBranch | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.category === 'rhythm' && e.label.startsWith(BRANCH_EVENT_PREFIX)) {
      return e.label.includes('Non-shockable') ? 'nonshockable' : 'shockable';
    }
  }
  return null;
}

export function airwayTypeFromLabel(label: string): AirwayType {
  return label.includes(SGA_LABEL) ? 'SGA' : 'ETT';
}

/** Airway type implied by the most recent placement event. */
export function airwayFromEvents(events: CodeEvent[]): AirwayType {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.category === 'airway' && e.label.startsWith(AIRWAY_EVENT_PREFIX)) return airwayTypeFromLabel(e.label);
  }
  return 'ETT';
}
