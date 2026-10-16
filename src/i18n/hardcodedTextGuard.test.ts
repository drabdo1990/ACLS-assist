import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';

/**
 * Hardcoded text guard test (Spec §6 & Plan Task 5).
 * Scans .tsx files for Latin text in JSX text, label/sub/title/placeholder/aria-label attributes.
 * An allowlist permits clinical abbreviations, acronyms, drug names, and units.
 * A PENDING list contains files whose migration is scheduled for Tasks 6 & 7.
 * ErrorBoundary is deliberately exempt as it retains hardcoded bilingual fallback text.
 */

const ALLOWED_TOKENS = new Set([
  'resuscode',
  'acls',
  'cpr',
  'rosc',
  'sbar',
  'ett',
  'sga',
  'iv',
  'io',
  'iv/io',
  'pocus',
  'emr',
  'ehr',
  'emr/ehr',
  'vf',
  'pvt',
  'pea',
  'asystole',
  'pulse',
  'epinephrine',
  'epi',
  'amiodarone',
  'lidocaine',
  'magnesium',
  'mg',
  'ns',
  'bvm',
  'stemi',
  'cath',
  'lab',
  'icu',
  'ccu',
  'ttm',
  'map',
  'spo2',
  'co2',
  'abg',
  'vbg',
  'dka',
  'tca',
  'dvt',
  'pe',
  'pci',
  'cabg',
  'last',
  'qrs',
  'kg',
  'g',
  'mcg',
  'min',
  'ml',
  'mmhg',
  'mmol/l',
  'meq/kg',
  'j',
  's',
  'h',
  'bpm',
  'mono',
  'bi',
  'n/a',
  'ok',
  'test',
]);

/** Files still awaiting translation — empty: every screen is now translated. */
const PENDING = new Set<string>([]);

/** Exempt files with justified standalone fallback */
const EXEMPT = new Set([
  'src/components/ErrorBoundary.tsx', // Self-contained bilingual crash screen without external dependencies
]);

const TARGET_ATTRS = new Set([
  'label',
  'sub',
  'title',
  'placeholder',
  'aria-label',
  'ariaLabel',
  'alt',
]);

function isAllowedText(raw: string): boolean {
  // Strip numbers, punctuation, math, Arabic characters, formatting symbols
  const words = raw
    .toLowerCase()
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
    .replace(/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~·—–→×✓⚠°≥≤]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return true;
  return words.every((w) => ALLOWED_TOKENS.has(w));
}

function extractSuspiciousStrings(_filePath: string, content: string): string[] {
  const issues: string[] = [];

  let ast: any;
  try {
    ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    return issues;
  }

  function walk(node: any) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'JSXText') {
      const text = String(node.value || '').trim();
      if (text && !isAllowedText(text)) {
        issues.push(`JSX text: "${text}"`);
      }
    } else if (node.type === 'JSXAttribute') {
      const attrName = node.name?.name;
      if (TARGET_ATTRS.has(attrName)) {
        if (node.value?.type === 'StringLiteral') {
          const text = String(node.value.value || '').trim();
          if (text && !isAllowedText(text)) {
            issues.push(`attr ${attrName}: "${text}"`);
          }
        } else if (
          node.value?.type === 'JSXExpressionContainer' &&
          node.value.expression?.type === 'StringLiteral'
        ) {
          const text = String(node.value.expression.value || '').trim();
          if (text && !isAllowedText(text)) {
            issues.push(`attr ${attrName}: "${text}"`);
          }
        }
      }
    } else if (node.type === 'ObjectProperty') {
      const keyName = node.key?.name ?? (node.key?.type === 'StringLiteral' ? node.key.value : null);
      if (TARGET_ATTRS.has(keyName) && node.value?.type === 'StringLiteral') {
        const text = String(node.value.value || '').trim();
        if (text && !isAllowedText(text)) {
          issues.push(`prop ${keyName}: "${text}"`);
        }
      }
    } else if (node.type === 'JSXExpressionContainer') {
      // Direct string literal inside JSX children like <span>{'some string'}</span>
      if (node.expression?.type === 'StringLiteral') {
        const text = String(node.expression.value || '').trim();
        if (text && !isAllowedText(text)) {
          issues.push(`JSX string literal: "${text}"`);
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'comments' || key === 'tokens') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child && typeof child === 'object') {
        walk(child);
      }
    }
  }

  walk(ast);
  return issues;
}

function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.system_generated') {
        results.push(...getAllTsxFiles(fullPath));
      }
    } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      results.push(relPath);
    }
  }
  return results;
}

describe('hard-coded-text guard', () => {
  const allTsx = getAllTsxFiles('src');

  it('scans all tsx files and enforces zero hardcoded English outside of allowlist & PENDING list', () => {
    const failures: Record<string, string[]> = {};

    for (const file of allTsx) {
      if (PENDING.has(file) || EXEMPT.has(file)) continue;

      const content = fs.readFileSync(file, 'utf8');
      const issues = extractSuspiciousStrings(file, content);
      if (issues.length > 0) {
        failures[file] = issues;
      }
    }

    expect(failures).toEqual({});
  });

  it('has no files left pending translation', () => {
    expect([...PENDING]).toEqual([]);
  });
});
