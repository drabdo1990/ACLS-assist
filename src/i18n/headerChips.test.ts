import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EN } from './en';
import { AR } from './ar';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, '..', rel), 'utf8');

/**
 * The header wake-lock chip and the cycle-panel rhythm buttons were English-only in Arabic mode:
 * their strings sit inside ternaries / are passed as values, which `hardcodedTextGuard` (JSX text
 * nodes only) cannot see. Guard them at source level and pin the English wording.
 */
describe('header wake-lock chip is translated', () => {
  const app = read('App.tsx');

  for (const literal of [
    "'AWAKE'",
    "'IDLE'",
    "'N/A'",
    "'Screen will not sleep'",
    "'Wake lock idle'",
    "'Wake Lock unsupported on this browser'",
  ]) {
    it(`App.tsx no longer hard-codes ${literal}`, () => {
      expect(app).not.toContain(literal);
    });
  }

  const expected: Record<string, string> = {
    'app.wake.titleActive': 'Screen will not sleep',
    'app.wake.titleIdle': 'Wake lock idle',
    'app.wake.titleUnsupported': 'Wake Lock unsupported on this browser',
    'app.wake.active': 'AWAKE',
    'app.wake.idle': 'IDLE',
    'app.wake.unsupported': 'N/A',
  };

  for (const [key, english] of Object.entries(expected)) {
    it(`${key} keeps the exact English text`, () => {
      expect((EN as Record<string, string>)[key]).toBe(english);
    });
    it(`${key} has an Arabic entry`, () => {
      expect((AR as Record<string, string>)[key]).toBeTruthy();
    });
    it(`App.tsx wires t('${key}')`, () => {
      expect(app).toContain(`'${key}'`);
    });
  }
});

describe('cycle-panel rhythm buttons are translated', () => {
  const panel = read('components/hud/CyclePanel.tsx');

  it('the rhythm button label goes through t(), not the raw rhythm id', () => {
    expect(panel).toMatch(/t\(`rhythm\.\$\{r\}`\)/);
    expect(panel).not.toMatch(/>\s*\{r\}\s*</);
  });

  it('the stored/logged rhythm id is still passed to resetCycle untouched', () => {
    expect(panel).toMatch(/resetCycle\(r\)/);
  });

  it('the existing rhythm.* keys keep the exact English button text', () => {
    expect((EN as Record<string, string>)['rhythm.Asystole']).toBe('Asystole');
    expect((EN as Record<string, string>)['rhythm.Pulse']).toBe('Pulse');
  });
});
