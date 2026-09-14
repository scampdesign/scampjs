import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildProject } from 'scampjs';
import { applyRecipe, drizzleRecipe, projectTemplate } from 'scampjs/templates';

// Phase 6's exit line: a project with a D1-backed load() and a plain
// POST handler, built with this adapter, runs as a Worker with static
// assets under Miniflare. The same project ran on SQLite in the
// framework's dev-server test with the same files.

const TMP = resolve(import.meta.dirname, '.tmp');
const quiet = { write: (): boolean => true };

describe('scamp build with @scampjs/adapter-cloudflare', () => {
  const dir = join(TMP, 'cf-app');
  let mf: Miniflare;
  const url = (path: string): string => `http://localhost${path}`;

  beforeAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    const base = projectTemplate({ name: 'cf-app', scampjsVersion: '^0.3.0' });
    const files = { ...base, ...applyRecipe(base, drizzleRecipe('d1')) };
    const pkg = JSON.parse(files['package.json'] ?? '{}') as Record<
      string,
      unknown
    >;
    pkg['scamp'] = { adapter: '@scampjs/adapter-cloudflare' };
    files['package.json'] = JSON.stringify(pkg, null, 2);
    files['routes/items.tsx'] = [
      "import { sql } from 'drizzle-orm';",
      "import type { LoadContext, RouteProps } from 'scampjs/runtime';",
      "import { db } from '@/lib/db';",
      "import { items } from '@/db/schema';",
      '',
      "export const render = 'server';",
      '',
      'export async function load({ env }: LoadContext) {',
      '  const d = db(env);',
      '  await d.run(sql`CREATE TABLE IF NOT EXISTS items (id integer primary key autoincrement, title text not null, created_at integer not null)`);',
      '  const rows = await d.select().from(items);',
      "  return { count: rows.length, titles: rows.map((r) => r.title), d1: 'DB' in env };",
      '}',
      '',
      'export default function Items({ data }: RouteProps<typeof load>) {',
      '  return <p>{data.count} items on {data.d1 ? "d1" : "sqlite"}: {data.titles.join(", ")}</p>;',
      '}',
      '',
    ].join('\n');
    files['routes/api/items.ts'] = [
      "import { sql } from 'drizzle-orm';",
      "import type { ApiHandler } from 'scampjs/runtime';",
      "import { db } from '@/lib/db';",
      "import { items } from '@/db/schema';",
      '',
      'export const POST: ApiHandler = async ({ request, env }) => {',
      '  const d = db(env);',
      '  await d.run(sql`CREATE TABLE IF NOT EXISTS items (id integer primary key autoincrement, title text not null, created_at integer not null)`);',
      '  const title = await request.text();',
      '  const [row] = await d.insert(items).values({ title }).returning();',
      '  return Response.json({ id: row?.id ?? null, title: row?.title ?? null });',
      '};',
      '',
    ].join('\n');
    files['public/robots.txt'] = 'User-agent: *\n';
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), content);
    }
    const result = await buildProject({ root: dir, stderr: quiet });
    expect(result.adapter).toBe('cloudflare');
    mf = new Miniflare({
      modules: true,
      scriptPath: join(dir, 'dist', '_worker.js'),
      compatibilityDate: '2026-07-01',
      compatibilityFlags: ['nodejs_compat'],
      assets: {
        directory: join(dir, 'dist'),
        binding: 'ASSETS',
        // What wrangler sets for a Worker with assets: misses reach the worker.
        routerConfig: { has_user_worker: true },
        assetConfig: {
          html_handling: 'auto-trailing-slash',
          not_found_handling: 'none',
        },
      },
      d1Databases: { DB: 'items-db' },
    });
    await mf.ready;
  }, 240_000);
  afterAll(async () => {
    await mf?.dispose();
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes the worker, the assets ignore file, and a wrangler.jsonc', () => {
    expect(existsSync(join(dir, 'dist', '_worker.js'))).toBe(true);
    expect(readFileSync(join(dir, 'dist', '.assetsignore'), 'utf8')).toBe(
      '_worker.js\n',
    );
    const config = readFileSync(join(dir, 'wrangler.jsonc'), 'utf8');
    expect(config).toContain('"name": "cf-app"');
    expect(config).toContain('"main": "dist/_worker.js"');
    expect(config).toContain('"directory": "dist"');
    expect(config).toContain('nodejs_compat');
    // The static page is a file the assets layer serves.
    expect(existsSync(join(dir, 'dist', 'index.html'))).toBe(true);
    expect(existsSync(join(dir, 'dist', 'items'))).toBe(false);
  });

  it('serves the prerendered page and public/ from assets', async () => {
    const home = await mf.dispatchFetch(url('/'));
    expect(home.status).toBe(200);
    expect(await home.text()).toContain('data-scamp-id="root"');
    const robots = await mf.dispatchFetch(url('/robots.txt'));
    expect(robots.status).toBe(200);
    expect(await robots.text()).toBe('User-agent: *\n');
  });

  it('runs a D1-backed load() in the worker and a POST handler that writes to it', async () => {
    const empty = await mf.dispatchFetch(url('/items'));
    expect(empty.status, await empty.clone().text()).toBe(200);
    expect(await empty.text()).toContain('0 items on d1');

    const post = await mf.dispatchFetch(url('/api/items'), {
      method: 'POST',
      body: 'from-the-edge',
    });
    expect(post.status, await post.clone().text()).toBe(200);
    expect(await post.json()).toMatchObject({ title: 'from-the-edge' });

    const after = await mf.dispatchFetch(url('/items'));
    expect(await after.text()).toContain('1 items on d1: from-the-edge');
    expect((await mf.dispatchFetch(url('/api/items'))).status).toBe(405);
    expect((await mf.dispatchFetch(url('/api/nope'))).status).toBe(404);
  });
});
