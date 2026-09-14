import { describe, expect, it } from 'vitest';
import { projectTemplate } from '../src/templates/index.js';
import { applyRecipe, RecipeConflict } from '../src/templates/recipe.js';
import { drizzleRecipe } from '../src/templates/recipes/drizzle.js';

describe('drizzleRecipe', () => {
  it('writes the schema, the client, and the drizzle-kit config for each dialect', () => {
    for (const dialect of ['sqlite', 'postgres', 'd1'] as const) {
      const r = drizzleRecipe(dialect);
      expect(Object.keys(r.files).sort()).toEqual([
        'db/schema.ts',
        'drizzle.config.ts',
        'lib/db.ts',
      ]);
      expect(r.scripts).toEqual({
        'db:generate': 'drizzle-kit generate',
        'db:migrate': 'drizzle-kit migrate',
        'db:studio': 'drizzle-kit studio',
      });
      expect(r.devDependencies['drizzle-kit']).toBeDefined();
      expect(r.agentMd).toContain('## Database');
    }
  });

  it('runs SQLite locally for the sqlite and d1 dialects, and D1 through env.DB on Cloudflare', () => {
    const d1 = drizzleRecipe('d1');
    expect(d1.files['lib/db.ts']).toContain('drizzle-orm/d1');
    expect(d1.files['lib/db.ts']).toContain('env.DB');
    expect(d1.files['lib/db.ts']).toContain('file:./dev.db');
    expect(d1.env).toEqual({
      DB: 'D1Database',
      DATABASE_URL: 'string | undefined',
    });
    expect(d1.envReferences).toEqual(['@cloudflare/workers-types']);
    expect(d1.devVars).toEqual({ DATABASE_URL: 'file:./dev.db' });
    const sqlite = drizzleRecipe('sqlite');
    expect(sqlite.files['lib/db.ts']).not.toContain('drizzle-orm/d1');
    expect(sqlite.dependencies['@libsql/client']).toBeDefined();
    const pg = drizzleRecipe('postgres');
    expect(pg.dependencies['postgres']).toBeDefined();
    expect(pg.files['drizzle.config.ts']).toContain("dialect: 'postgresql'");
    expect(pg.gitignore).toEqual([]);
  });
});

describe('applyRecipe', () => {
  const base = projectTemplate({ name: 'app', scampjsVersion: '^0.3.0' });

  it('adds the files and merges package.json, scamp-env.d.ts, .dev.vars, .gitignore, and agent.md', () => {
    const changes = applyRecipe(base, drizzleRecipe('sqlite'));
    expect(Object.keys(changes).sort()).toEqual([
      '.dev.vars',
      '.gitignore',
      'agent.md',
      'db/schema.ts',
      'drizzle.config.ts',
      'lib/db.ts',
      'package.json',
      'scamp-env.d.ts',
    ]);
    const pkg = JSON.parse(changes['package.json'] ?? '') as {
      name: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.name).toBe('app');
    expect(pkg.scripts['dev']).toBe('scamp dev');
    expect(pkg.scripts['db:generate']).toBe('drizzle-kit generate');
    expect(pkg.dependencies['scampjs']).toBe('^0.3.0');
    expect(pkg.dependencies['drizzle-orm']).toBeDefined();
    expect(pkg.devDependencies['drizzle-kit']).toBeDefined();
    expect(changes['scamp-env.d.ts']).toContain(
      "declare module 'scampjs/runtime' {\n  interface Env {\n    DATABASE_URL: string | undefined;\n  }\n}",
    );
    expect(changes['scamp-env.d.ts']?.trimEnd().endsWith('export {};')).toBe(
      true,
    );
    expect(changes['.dev.vars']).toBe('DATABASE_URL=file:./dev.db\n');
    expect(changes['.gitignore']).toContain('dev.db');
    expect(changes['agent.md']).toContain('<!-- scamp:recipe:drizzle -->');
  });

  it('is idempotent: applying again to the result changes nothing', () => {
    const once = { ...base, ...applyRecipe(base, drizzleRecipe('sqlite')) };
    expect(applyRecipe(once, drizzleRecipe('sqlite'))).toEqual({});
  });

  it('keeps what the project already has in package.json and .dev.vars', () => {
    const files = {
      ...base,
      'package.json': JSON.stringify({
        name: 'app',
        scripts: { dev: 'scamp dev', 'db:migrate': 'my-own' },
        dependencies: { zod: '^3' },
      }),
      '.dev.vars': 'DATABASE_URL=file:./mine.db\n',
    };
    const changes = applyRecipe(files, drizzleRecipe('sqlite'));
    const pkg = JSON.parse(changes['package.json'] ?? '') as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.scripts['db:migrate']).toBe('my-own');
    expect(pkg.dependencies['zod']).toBe('^3');
    expect(pkg.dependencies['drizzle-orm']).toBeDefined();
    expect(changes['.dev.vars']).toBeUndefined();
  });

  it('refuses to overwrite a recipe file that differs, unless forced', () => {
    const files = { ...base, 'lib/db.ts': 'export const db = 1;\n' };
    expect(() => applyRecipe(files, drizzleRecipe('sqlite'))).toThrow(
      RecipeConflict,
    );
    expect(
      applyRecipe(files, drizzleRecipe('sqlite'), { force: true })['lib/db.ts'],
    ).toContain('drizzle');
  });

  it('adds the D1 reference and both Env fields for d1', () => {
    const env = applyRecipe(base, drizzleRecipe('d1'))['scamp-env.d.ts'] ?? '';
    expect(env).toContain(
      '/// <reference types="@cloudflare/workers-types" />',
    );
    expect(env).toContain('DB: D1Database;');
  });
});
