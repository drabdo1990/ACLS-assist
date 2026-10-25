import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

/**
 * No-DOM smoke test: all three screens are mounted at once (the inactive ones are hidden
 * with CSS), so this catches import-time crashes, bad hooks and render errors across the
 * whole shell. Interaction behaviour still needs a real browser.
 */
describe('App shell', () => {
  it('renders the HUD, causes and log screens without throwing', () => {
    const html = renderToStaticMarkup(createElement(App, { pendingEnroll: { kind: 'none' } as const }));
    expect(html).toContain('ResusCode');
    expect(html).toContain('START CODE');
    expect(html).toContain('START SIMULATION');
    expect(html).toContain('History');
  });
});
