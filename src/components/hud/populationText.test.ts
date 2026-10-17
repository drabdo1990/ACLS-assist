import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EN } from '../../i18n/en';
import { AR } from '../../i18n/ar';
import { appTitleKey, epiFlushKey, roscBannerSubKey } from './populationText';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string) => readFileSync(join(here, '..', '..', rel), 'utf8');

describe('population-specific HUD text keys', () => {
  it('adult keeps the existing adult keys', () => {
    expect(appTitleKey('adult')).toBe('app.title');
    expect(epiFlushKey('adult')).toBe('hud.grid.epi.flush');
    expect(roscBannerSubKey('adult')).toBe('hud.roscBanner.sub');
  });

  it('pediatric uses its own keys', () => {
    expect(appTitleKey('pediatric')).toBe('app.title.pediatric');
    expect(epiFlushKey('pediatric')).toBe('peds.grid.epi.flush');
    expect(roscBannerSubKey('pediatric')).toBe('peds.roscBanner.sub');
  });

  it('every key exists in English and Arabic', () => {
    for (const pop of ['adult', 'pediatric'] as const) {
      for (const key of [appTitleKey(pop), epiFlushKey(pop), roscBannerSubKey(pop)]) {
        expect(EN[key], `en ${key}`).toBeTruthy();
        expect(AR[key], `ar ${key}`).toBeTruthy();
      }
    }
  });

  it('pediatric text carries no adult-only targets or volumes', () => {
    const texts = [
      EN[appTitleKey('pediatric')],
      EN[epiFlushKey('pediatric')],
      EN[roscBannerSubKey('pediatric')],
    ].join(' | ');
    expect(texts).not.toMatch(/Adult|ACLS|MAP|TTM|20 mL|92/);
    expect(EN[epiFlushKey('pediatric')]).toBe('IV/IO + saline flush');
    expect(EN[appTitleKey('pediatric')]).toBe('Pediatric PALS Command');
    // Only the SpO2 / SBP values already present in the pediatric post-ROSC content.
    expect(EN[roscBannerSubKey('pediatric')]).toContain('SpO₂ 94–99%');
    expect(EN[roscBannerSubKey('pediatric')]).toContain('SBP');
  });

  it('adult strings are unchanged', () => {
    expect(EN['app.title']).toBe('Adult ACLS Command');
    expect(EN['hud.grid.epi.flush']).toBe('IV/IO + 20 mL NS flush');
    expect(EN['hud.roscBanner.sub']).toBe('MAP ≥ 65 · SpO₂ 92–98% · 12-lead · TTM — open checklist');
  });
});

describe('components route the three strings through the population helper', () => {
  it('App.tsx picks the header title by population', () => {
    const src = readSrc('App.tsx');
    expect(src).toMatch(/appTitleKey\(/);
    expect(src).not.toMatch(/t\('app\.title'\)/);
  });

  it('HudScreen.tsx picks the ROSC banner sub-line by population', () => {
    const src = readSrc('screens/HudScreen.tsx');
    expect(src).toMatch(/roscBannerSubKey\(/);
    expect(src).not.toMatch(/t\('hud\.roscBanner\.sub'\)/);
  });

  it('InterventionGrid.tsx picks the epinephrine flush line by population', () => {
    const src = readSrc('components/hud/InterventionGrid.tsx');
    expect(src).toMatch(/epiFlushKey\(/);
    expect(src).not.toMatch(/t\('hud\.grid\.epi\.flush'\)/);
  });
});
