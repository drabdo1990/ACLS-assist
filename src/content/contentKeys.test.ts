import { describe, it, expect } from 'vitest';
import { CAUSES } from './causes';
import { POCUS_ITEMS } from './pocus';
import { POST_ROSC_BUNDLE } from './protocols';
import { nextAclsStep, type AlgorithmInput } from './algorithm';
import { EN, type MessageKey } from '../i18n/en';
import { AR } from '../i18n/ar';

describe('clinical content keys pin to English content data', () => {
  it('causes keys match CAUSES data', () => {
    for (const c of CAUSES) {
      expect(EN[`cause.${c.id}.label` as MessageKey]).toBe(c.label);
      expect(EN[`cause.${c.id}.clue` as MessageKey]).toBe(c.clue);
      expect(EN[`cause.${c.id}.action` as MessageKey]).toBe(c.action);
    }
  });

  it('POCUS keys match POCUS_ITEMS data', () => {
    for (const p of POCUS_ITEMS) {
      expect(EN[`pocus.${p.id}.view` as MessageKey]).toBe(p.view);
      expect(EN[`pocus.${p.id}.label` as MessageKey]).toBe(p.label);
      expect(EN[`pocus.${p.id}.meaning` as MessageKey]).toBe(p.meaning);
    }
  });

  it('post-ROSC keys match POST_ROSC_BUNDLE data', () => {
    for (const b of POST_ROSC_BUNDLE) {
      expect(EN[`postRosc.${b.id}` as MessageKey]).toBe(b.text);
    }
  });

  it('algorithm steps and views carry keys that match English', () => {
    const inputs: AlgorithmInput[] = [
      { branch: null, shocks: 0, epi: 0, antiarrhythmic: 0, causesChecked: 0 },
      { branch: 'shockable', shocks: 0, epi: 0, antiarrhythmic: 0, causesChecked: 0 },
      { branch: 'shockable', shocks: 2, epi: 1, antiarrhythmic: 1, causesChecked: 0 },
      { branch: 'shockable', shocks: 3, epi: 2, antiarrhythmic: 2, causesChecked: 0 },
      { branch: 'nonshockable', shocks: 0, epi: 0, antiarrhythmic: 0, causesChecked: 0 },
      { branch: 'nonshockable', shocks: 0, epi: 1, antiarrhythmic: 0, causesChecked: 2 },
    ];

    for (const input of inputs) {
      const v = nextAclsStep(input);
      expect(v.titleKey).toBeTruthy();
      expect(EN[v.titleKey as MessageKey], v.title).toBe(v.title);
      expect(AR[v.titleKey as MessageKey]).toBeTruthy();

      expect(v.ongoingKey).toBeTruthy();
      expect(EN[v.ongoingKey as MessageKey], v.ongoing).toBe(v.ongoing);
      expect(AR[v.ongoingKey as MessageKey]).toBeTruthy();

      for (const step of v.steps) {
        expect(step.key).toBeTruthy();
        expect(EN[step.key as MessageKey], step.label).toBe(step.label);
        expect(AR[step.key as MessageKey]).toBeTruthy();
      }
    }
  });
});
