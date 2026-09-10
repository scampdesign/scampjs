import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTRACT_VERSION } from '../src/index.js';

const pkgPath = resolve(import.meta.dirname, '..', 'package.json');

type Pkg = { scampjs?: { contract?: unknown } };

describe('contract version', () => {
  it('package.json scampjs.contract equals CONTRACT_VERSION', () => {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Pkg;
    expect(pkg.scampjs?.contract).toBe(CONTRACT_VERSION);
  });

  it('CONTRACT.md declares the same version', () => {
    const contract = readFileSync(
      resolve(import.meta.dirname, '..', '..', '..', 'CONTRACT.md'),
      'utf8',
    );
    const match = /^Contract version: \*\*(\d+)\*\*/m.exec(contract);
    expect(match?.[1]).toBe(String(CONTRACT_VERSION));
  });
});
