import { describe, it, expect } from 'vitest';
import { nextAclsStep, type AlgorithmInput } from './algorithm';

const base: AlgorithmInput = { branch: 'shockable', shocks: 0, epi: 0, antiarrhythmic: 0, causesChecked: 0 };
const current = (i: AlgorithmInput) => nextAclsStep(i).steps.find((s) => s.state === 'current')?.id;

describe('nextAclsStep — no branch', () => {
  it('asks the team to pick a branch', () => {
    const v = nextAclsStep({ ...base, branch: null });
    expect(v.steps).toHaveLength(0);
    expect(v.focus).toBeNull();
    expect(v.title).toBe('Select rhythm branch');
  });
});

describe('nextAclsStep — VF / pVT', () => {
  it('walks shock → CPR → shock → epi → shock → antiarrhythmic', () => {
    expect(current(base)).toBe('shock1');
    expect(nextAclsStep(base).focus).toBe('shock');
    expect(current({ ...base, shocks: 1 })).toBe('cpr1');
    expect(current({ ...base, shocks: 2 })).toBe('epi');
    expect(nextAclsStep({ ...base, shocks: 2 }).focus).toBe('epi');
    expect(current({ ...base, shocks: 2, epi: 1 })).toBe('shock3');
    expect(current({ ...base, shocks: 3, epi: 1 })).toBe('aa');
  });

  it('completes the script and shows ongoing guidance', () => {
    const v = nextAclsStep({ ...base, shocks: 3, epi: 1, antiarrhythmic: 1 });
    expect(v.steps.every((s) => s.state === 'done')).toBe(true);
    expect(v.focus).toBeNull();
    expect(v.ongoing).toContain('150 mg');
  });

  it('tolerates out-of-order logging (epi before shock #2)', () => {
    expect(current({ ...base, shocks: 1, epi: 1 })).toBe('shock2');
  });
});

describe('nextAclsStep — Asystole / PEA', () => {
  const ns: AlgorithmInput = { ...base, branch: 'nonshockable' };

  it('prioritises immediate epinephrine', () => {
    expect(current(ns)).toBe('epi');
    expect(nextAclsStep(ns).focus).toBe('epi');
  });

  it('then reversible causes, then ongoing rhythm rechecks', () => {
    expect(current({ ...ns, epi: 1 })).toBe('causes');
    const v = nextAclsStep({ ...ns, epi: 1, causesChecked: 2 });
    expect(v.focus).toBeNull();
    expect(v.ongoing).toContain('recheck rhythm');
  });
});
