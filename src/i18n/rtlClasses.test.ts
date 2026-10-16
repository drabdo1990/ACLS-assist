/**
 * RTL guard: layouts must use logical Tailwind utilities (ms/me/ps/pe/start/end/text-start/text-end)
 * so Arabic mirrors correctly. Physical left/right utilities are rejected in every .tsx file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PHYSICAL =
  /(?<![\w-])-?(?:ml|mr|pl|pr|left|right|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-[\w./[\]]+|(?<![\w-])(?:text-left|text-right|float-left|float-right|clear-left|clear-right)(?![\w-])|(?<![\w-])(?:rounded|border)-(?:l|r|tl|tr|bl|br)(?:-[\w./[\]]+)?(?![\w-])/g;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.name.endsWith('.tsx')) out.push(full.replace(/\\/g, '/'));
  }
  return out;
}

/** Only class strings are scanned: className="…" and string literals inside className={…}. */
function classStrings(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{([\s\S]*?)\}\s*(?=[\s/>]))/g)) {
    if (m[1] != null) out.push(m[1]);
    else for (const s of (m[2] ?? '').matchAll(/['"`]([^'"`]*)['"`]/g)) out.push(s[1]);
  }
  return out;
}

describe('RTL layout guard', () => {
  it('uses no physical left/right utilities in className strings', () => {
    const found: Record<string, string[]> = {};
    for (const file of tsxFiles('src')) {
      const hits = classStrings(fs.readFileSync(file, 'utf8')).flatMap((c) => c.match(PHYSICAL) ?? []);
      if (hits.length) found[file] = hits;
    }
    expect(found).toEqual({});
  });

  it('detects physical utilities (self-check)', () => {
    const sample = classStrings('<div className="ml-auto text-left border-r-2 ms-auto" />').flatMap(
      (c) => c.match(PHYSICAL) ?? [],
    );
    expect(sample).toEqual(['ml-auto', 'text-left', 'border-r-2']);
  });
});
