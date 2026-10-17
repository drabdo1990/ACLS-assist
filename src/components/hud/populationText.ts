import type { Population } from '../../content/profiles';
import type { MessageKey } from '../../i18n/en';

/**
 * Population-specific message keys for HUD text that used to be adult-only.
 * Pure (no React) so the selection is unit-testable in the node-only suite.
 * Adult keys are the original ones, untouched; pediatric text reuses values already present in
 * content/profiles/pediatric.ts or is neutral wording with no number.
 */

/** Header subtitle. */
export function appTitleKey(population: Population): MessageKey {
  return population === 'pediatric' ? 'app.title.pediatric' : 'app.title';
}

/** Epinephrine button sub-line shown when no lockout/eligibility message applies. */
export function epiFlushKey(population: Population): MessageKey {
  return population === 'pediatric' ? 'peds.grid.epi.flush' : 'hud.grid.epi.flush';
}

/** Post-ROSC banner targets line. */
export function roscBannerSubKey(population: Population): MessageKey {
  return population === 'pediatric' ? 'peds.roscBanner.sub' : 'hud.roscBanner.sub';
}
