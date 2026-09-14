/**
 * The Drizzle recipe (CONTRACT.md section 3.2): the files, dependencies,
 * scripts, secrets, `Env` fields, and `agent.md` section that give a
 * project a database on one of three dialects. Local development runs
 * SQLite on disk for the SQLite and D1 choices; D1 takes over on
 * Cloudflare through `env.DB`. Pure: `applyRecipe` writes it.
 */
import type { Recipe } from '../recipe.js';

export type DrizzleDialect = 'sqlite' | 'postgres' | 'd1';
export const DRIZZLE_DIALECTS: ReadonlyArray<DrizzleDialect> = [
  'sqlite',
  'postgres',
  'd1',
];

export const isDrizzleDialect = (value: unknown): value is DrizzleDialect =>
  value === 'sqlite' || value === 'postgres' || value === 'd1';

const SQLITE_SCHEMA = `import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// One example table so the shape is visible. Edit freely; then
// \`npm run db:generate\` writes the migration and \`npm run db:migrate\`
// applies it.
export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
`;

const POSTGRES_SCHEMA = `import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// One example table so the shape is visible. Edit freely; then
// \`npm run db:generate\` writes the migration and \`npm run db:migrate\`
// applies it.
export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
`;

const SQLITE_DB = `import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { Env } from 'scampjs/runtime';
import * as schema from '@/db/schema';

/**
 * The database client for a request. Built from \`env\` so the same call
 * works in \`scamp dev\`, at build time, and on every adapter.
 */
export const db = (env: Env) =>
  drizzle(createClient({ url: env.DATABASE_URL ?? 'file:./dev.db' }), { schema });
`;

const POSTGRES_DB = `import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Env } from 'scampjs/runtime';
import * as schema from '@/db/schema';

/**
 * The database client for a request. Built from \`env\` so the same call
 * works in \`scamp dev\`, at build time, and on every adapter.
 */
export const db = (env: Env) => {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set; see .dev.vars.');
  return drizzle(postgres(env.DATABASE_URL, { prepare: false }), { schema });
};
`;

const D1_DB = `import { createClient } from '@libsql/client';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql';
import type { Env } from 'scampjs/runtime';
import * as schema from '@/db/schema';

/**
 * The database client for a request. On Cloudflare \`env.DB\` is the D1
 * binding; locally (\`scamp dev\`, the build) there is none, and the same
 * schema runs on SQLite on disk. Nothing else in the project changes.
 */
export const db = (env: Env) =>
  env.DB
    ? drizzleD1(env.DB, { schema })
    : drizzleSqlite(createClient({ url: env.DATABASE_URL ?? 'file:./dev.db' }), { schema });
`;

const config = (
  dialect: DrizzleDialect,
): string => `import { readFileSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside the framework, so it reads .dev.vars itself.
const devVars = (): Record<string, string> => {
  try {
    return Object.fromEntries(
      readFileSync('.dev.vars', 'utf8')
        .split('\\n')
        .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
        .map((line) => {
          const i = line.indexOf('=');
          return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
};
const env = { ...devVars(), ...process.env };

export default defineConfig({
  dialect: '${dialect === 'postgres' ? 'postgresql' : 'sqlite'}',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: env['DATABASE_URL'] ?? '${dialect === 'postgres' ? 'postgres://localhost:5432/app' : 'file:./dev.db'}' },
});
`;

const agentMd = (dialect: DrizzleDialect): string => `## Database

This project uses [Drizzle](https://orm.drizzle.team) on ${
  dialect === 'postgres'
    ? 'Postgres'
    : dialect === 'd1'
      ? 'Cloudflare D1 (SQLite locally)'
      : 'SQLite'
}.

- \`db/schema.ts\` is the schema: tables as code. Edit it, then run
  \`npm run db:generate\` to write a migration under \`drizzle/\` and
  \`npm run db:migrate\` to apply it. \`npm run db:studio\` opens a browser.
- \`lib/db.ts\` exports \`db(env)\`, the client for one request. Always
  build it from the \`env\` a \`load()\` or an API handler receives; never
  at module scope.
- **Read in \`load()\`, write in an API route.** A route's \`load()\` queries
  through \`db(env)\` and maps rows to the view's props; a \`POST\` handler
  under \`routes/api/\` writes. The view's props are not the schema: the
  mapping belongs in the route file.

\`\`\`ts
import { eq } from 'drizzle-orm';
import type { LoadContext } from 'scampjs/runtime';
import { db } from '@/lib/db';
import { items } from '@/db/schema';

export async function load({ env }: LoadContext) {
  const rows = await db(env).select().from(items).orderBy(items.createdAt);
  return { items: rows.map((r) => ({ id: String(r.id), label: r.title })) };
}
\`\`\`
${
  dialect === 'd1'
    ? `
On Cloudflare, \`env.DB\` is the D1 binding named in \`wrangler.jsonc\`;
apply migrations there with \`npx wrangler d1 migrations apply <name>\`.
Locally there is no binding, so \`db(env)\` opens \`dev.db\` on disk.
`
    : dialect === 'postgres'
      ? `
\`DATABASE_URL\` in \`.dev.vars\` points at the local database; set the
same variable as a secret on the host you deploy to.
`
      : `
\`DATABASE_URL\` in \`.dev.vars\` points at \`dev.db\`; a deploy needs a
hosted SQLite (libSQL) URL in the same variable, or the D1 dialect.
`
}`;

export const drizzleRecipe = (dialect: DrizzleDialect): Recipe => {
  const sqlite = dialect !== 'postgres';
  return {
    name: 'drizzle',
    files: {
      'db/schema.ts': sqlite ? SQLITE_SCHEMA : POSTGRES_SCHEMA,
      'lib/db.ts': dialect === 'd1' ? D1_DB : sqlite ? SQLITE_DB : POSTGRES_DB,
      'drizzle.config.ts': config(dialect),
    },
    dependencies: {
      'drizzle-orm': '^0.45.2',
      ...(sqlite ? { '@libsql/client': '^0.18.0' } : { postgres: '^3.4.9' }),
    },
    devDependencies: {
      'drizzle-kit': '^0.31.10',
      ...(dialect === 'd1' ? { '@cloudflare/workers-types': '^5.0.0' } : {}),
    },
    scripts: {
      'db:generate': 'drizzle-kit generate',
      'db:migrate': 'drizzle-kit migrate',
      'db:studio': 'drizzle-kit studio',
    },
    devVars: sqlite
      ? { DATABASE_URL: 'file:./dev.db' }
      : { DATABASE_URL: 'postgres://user:password@localhost:5432/app' },
    env: {
      ...(dialect === 'd1' ? { DB: 'D1Database' } : {}),
      DATABASE_URL: 'string | undefined',
    },
    envReferences: dialect === 'd1' ? ['@cloudflare/workers-types'] : [],
    gitignore: sqlite ? ['dev.db', 'dev.db-*'] : [],
    agentMd: agentMd(dialect),
  };
};
