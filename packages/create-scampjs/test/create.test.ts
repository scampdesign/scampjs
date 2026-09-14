import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Runs the bin as `npm create scampjs` would. It imports scampjs/templates,
// which resolves to the built framework in this workspace.

const bin = resolve(import.meta.dirname, '..', 'bin', 'create-scampjs.js');

const run = (
  args: string[],
  cwd: string,
): { status: number | null; stdout: string; stderr: string } =>
  spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });

describe('create-scampjs', () => {
  let cwd: string | null = null;
  afterEach(() => {
    if (cwd !== null) rmSync(cwd, { recursive: true, force: true });
    cwd = null;
  });

  it('scaffolds the framework project template into the named folder without prompting', () => {
    cwd = mkdtempSync(join(tmpdir(), 'create-scampjs-'));
    const result = run(['noise', '--yes'], cwd);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Created noise');
    expect(result.stdout).toContain('npm install');
    const dir = join(cwd, 'noise');
    for (const file of [
      'package.json',
      'tsconfig.json',
      'design/theme.css',
      'routes/index.tsx',
      'views/Home/Home.tsx',
      'views/Home/Home.module.css',
      'scamp-env.d.ts',
      '.gitignore',
      'agent.md',
    ]) {
      expect(existsSync(join(dir, file)), file).toBe(true);
    }
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(pkg.name).toBe('noise');
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['preact', 'scampjs']);
  });

  it('takes --name and --db none', () => {
    cwd = mkdtempSync(join(tmpdir(), 'create-scampjs-'));
    const result = run(['app', '--name', 'my-app', '--db', 'none', '-y'], cwd);
    expect(result.status, result.stderr).toBe(0);
    const pkg = JSON.parse(
      readFileSync(join(cwd, 'app', 'package.json'), 'utf8'),
    ) as { name: string };
    expect(pkg.name).toBe('my-app');
  });

  it('applies the Drizzle recipe for --db sqlite', () => {
    cwd = mkdtempSync(join(tmpdir(), 'create-scampjs-'));
    const result = run(['withdb', '--db', 'sqlite', '-y'], cwd);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('sqlite database through Drizzle');
    expect(result.stdout).toContain('npm run db:migrate');
    const dir = join(cwd, 'withdb');
    for (const file of [
      'db/schema.ts',
      'lib/db.ts',
      'drizzle.config.ts',
      '.dev.vars',
    ]) {
      expect(existsSync(join(dir, file)), file).toBe(true);
    }
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(pkg.dependencies['drizzle-orm']).toBeDefined();
    expect(pkg.dependencies['@libsql/client']).toBeDefined();
    expect(pkg.devDependencies['drizzle-kit']).toBeDefined();
    expect(pkg.scripts['db:migrate']).toBe('drizzle-kit migrate');
    expect(readFileSync(join(dir, 'scamp-env.d.ts'), 'utf8')).toContain(
      'DATABASE_URL: string | undefined;',
    );
    expect(readFileSync(join(dir, 'agent.md'), 'utf8')).toContain(
      '## Database',
    );
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('dev.db');
  });

  it('refuses an unknown database, a bad name, and a non-empty folder', () => {
    cwd = mkdtempSync(join(tmpdir(), 'create-scampjs-'));
    expect(run(['x', '--db', 'mongo', '-y'], cwd).stderr).toContain(
      'not one of',
    );
    expect(run(['x', '--name', 'Bad Name', '-y'], cwd).stderr).toContain(
      'not a valid package name',
    );
    writeFileSync(join(cwd, 'taken'), '');
    const taken = run(['taken', '-y'], cwd);
    expect(taken.status).toBe(1);
    expect(readdirSync(cwd)).toEqual(['taken']);
  });

  it('prints usage for --help and errors on an unknown flag', () => {
    cwd = mkdtempSync(join(tmpdir(), 'create-scampjs-'));
    expect(run(['--help'], cwd).stdout).toContain('Usage: npm create scampjs');
    expect(run(['--frob'], cwd).status).toBe(1);
  });
});
