import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// CONTRACT.md quotes from fixtures/contract-0 instead of carrying its own
// copies. A fenced block preceded by `<!-- fixture: <path> -->` must be an
// exact substring of that fixture file (blank lines between marker and
// fence are fine; Prettier adds one). Blocks without the marker (JSON
// shapes, CLI lines, sketches of later contracts) are not checked.

const root = resolve(import.meta.dirname, '..', '..', '..');
const fixtureRootFor = (name: string): string =>
  resolve(import.meta.dirname, '..', 'fixtures', name);
const contract = readFileSync(join(root, 'CONTRACT.md'), 'utf8');

type Quote = { fixture: string; path: string; body: string; line: number };

const collectQuotes = (md: string): Quote[] => {
  const quotes: Quote[] = [];
  const re =
    /<!-- fixture(?:\(([^)]+)\))?: ([^\s]+) -->\s*```[^\n]*\r?\n([\s\S]*?)```/g;
  for (const m of md.matchAll(re)) {
    const line = md.slice(0, m.index).split('\n').length;
    quotes.push({
      fixture: m[1] ?? 'contract-0',
      path: m[2] ?? '',
      body: m[3] ?? '',
      line,
    });
  }
  return quotes;
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

describe('CONTRACT.md quotes the fixture', () => {
  const quotes = collectQuotes(contract);

  it('has fixture-backed quotes', () => {
    expect(quotes.length).toBeGreaterThan(0);
  });

  for (const q of quotes) {
    it(`line ${q.line}: ${q.fixture}/${q.path}`, () => {
      const file = readFileSync(
        join(fixtureRootFor(q.fixture), q.path),
        'utf8',
      );
      expect(file).toContain(q.body);
    });
  }
});

describe('fixture views and components', () => {
  const files = walk(fixtureRootFor('contract-0')).filter(
    (f) => /[/\\](views|components)[/\\]/.test(f) && f.endsWith('.tsx'),
  );

  it('exist', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.slice(fixtureRootFor('contract-0').length + 1);
    const src = readFileSync(file, 'utf8');

    it(`${rel} ends with a _scamp export for contract 0`, () => {
      const meta =
        /export const _scamp = \{ contract: (\d+), events: \[([^\]]*)\] \} as const;\n$/.exec(
          src,
        );
      expect(meta, 'missing or malformed _scamp export').not.toBeNull();
      expect(meta?.[1]).toBe('0');
    });

    it(`${rel} lists exactly its function-typed props as events`, () => {
      const meta = /events: \[([^\]]*)\]/.exec(src);
      const declared = (meta?.[1] ?? '')
        .split(',')
        .map((s) => s.trim().replace(/^'|'$/g, ''))
        .filter(Boolean);
      const propsBlock =
        /type \w+Props = \{([\s\S]*?)\n\};/.exec(src)?.[1] ?? '';
      const handlers = [
        ...propsBlock.matchAll(/^\s*(\w+)\?: \([^)]*\) => void;/gm),
      ].map((m) => m[1]);
      expect(declared).toEqual(handlers);
    });

    it(`${rel} has a sibling CSS module`, () => {
      expect(() =>
        statSync(file.replace(/\.tsx$/, '.module.css')),
      ).not.toThrow();
    });
  }
});
