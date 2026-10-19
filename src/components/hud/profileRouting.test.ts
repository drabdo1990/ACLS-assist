import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { profileFor } from '../../content/profiles';
import { EN, type MessageKey } from '../../i18n/en';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8');

/**
 * The suite is node-only (no DOM), so these guard the wiring at source level: HUD components
 * must reach the algorithm through the population profile, never the adult `nextAclsStep`
 * directly — a direct call showed "Epinephrine 1 mg" in a pediatric code.
 */
describe('HUD algorithm routing', () => {
  for (const file of ['RhythmBranch.tsx', 'InterventionGrid.tsx']) {
    it(`${file} does not call the adult nextAclsStep directly`, () => {
      expect(read(file)).not.toMatch(/\bnextAclsStep\b/);
    });
  }

  it('RhythmBranch picks the algorithm from the session population profile', () => {
    const src = read('RhythmBranch.tsx');
    expect(src).toMatch(/profileFor\(/);
    expect(src).toMatch(/\.algorithm\(/);
    expect(src).toMatch(/population/);
  });
});

describe('pediatric algorithm view carries no adult doses', () => {
  const input = { branch: 'shockable' as const, shocks: 0, epi: 0, antiarrhythmic: 0, causesChecked: 0 };

  it('shockable steps are weight-based, not the adult fixed doses', () => {
    const view = profileFor('pediatric').algorithm(input);
    const labels = view.steps.map((s) => EN[s.key as MessageKey]).join(' | ');
    expect(labels).toContain('0.01 mg/kg');
    expect(labels).not.toMatch(/Epinephrine 1 mg/);
    expect(labels).not.toMatch(/300 mg/);
  });
});
