import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { projectTemplate } from '../src/templates/index.js';

const bin = resolve(import.meta.dirname, '..', 'bin', 'scamp.js');
const TMP = resolve(import.meta.dirname, '.tmp');

const scaffold = (name: string): string => {
  const dir = join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  for (const [file, content] of Object.entries(
    projectTemplate({ name, scampjsVersion: '^0.3.0' }),
  )) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  return dir;
};

const run = (
  args: string[],
  cwd: string,
): { status: number | null; stdout: string; stderr: string } =>
  spawnSync(process.execPath, [bin, 'add', ...args], { cwd, encoding: 'utf8' });

describe('scamp add drizzle', () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir !== null) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it('writes the recipe, says what to run next, and is a no-op the second time', () => {
    dir = scaffold('add-sqlite');
    const first = run(['drizzle', '--dialect', 'sqlite'], dir);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain('db/schema.ts');
    expect(first.stdout).toContain('npm run db:migrate');
    expect(existsSync(join(dir, 'lib', 'db.ts'))).toBe(true);
    expect(readFileSync(join(dir, 'package.json'), 'utf8')).toContain(
      'drizzle-orm',
    );
    const second = run(['drizzle'], dir);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('already applied');
  });

  it('refuses a conflicting file and an unknown dialect or recipe', () => {
    dir = scaffold('add-conflict');
    mkdirSync(join(dir, 'lib'), { recursive: true });
    writeFileSync(join(dir, 'lib', 'db.ts'), 'export const db = 1;\n');
    const conflict = run(['drizzle'], dir);
    expect(conflict.status).toBe(1);
    expect(conflict.stderr).toContain('lib/db.ts exists');
    expect(run(['drizzle', '--dialect', 'mongo'], dir).stderr).toContain(
      '--dialect must be one of',
    );
    expect(run(['prisma'], dir).stderr).toContain('Unknown recipe');
    expect(run([], dir).status).toBe(1);
  });
});
