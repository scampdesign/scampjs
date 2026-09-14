import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDevServer, type DevServer } from '../src/dev/server.js';
import {
  applyRecipe,
  drizzleRecipe,
  projectTemplate,
} from '../src/templates/index.js';

// The fixture is the first project scamp dev has to run. The scaffolded
// project under test/.tmp proves the templates and that load() reads
// env; it sits inside the repo so `preact` resolves through the
// workspace's node_modules.

const fixture = resolve(import.meta.dirname, '..', 'fixtures', 'contract-2');
const tmp = resolve(import.meta.dirname, '.tmp', 'scaffold');

const quiet = { write: (): boolean => true };

const get = async (
  server: DevServer,
  path: string,
): Promise<{ status: number; text: string; type: string }> => {
  const res = await fetch(`${server.url}${path}`);
  return {
    status: res.status,
    text: await res.text(),
    type: res.headers.get('content-type') ?? '',
  };
};

describe('scamp dev on the contract-0 fixture', () => {
  let server: DevServer;
  beforeAll(async () => {
    server = await createDevServer({
      root: fixture,
      stdout: quiet,
      stderr: quiet,
    });
  }, 30_000);
  afterAll(async () => {
    await server.close();
  });

  it('binds 127.0.0.1 on a free port', () => {
    expect(server.url).toBe(`http://127.0.0.1:${server.port}`);
    expect(server.port).toBeGreaterThan(0);
  });

  it('GET /_views/ lists the views sorted, and no components', async () => {
    const res = await get(server, '/_views/');
    expect(res.status).toBe(200);
    expect(res.type).toContain('application/json');
    expect(JSON.parse(res.text)).toEqual({ views: ['Home', 'Lobby'] });
  });

  it('GET /_views/Lobby renders the view with its defaults, styles inlined, theme first', async () => {
    const res = await get(server, '/_views/Lobby');
    expect(res.status).toBe(200);
    expect(res.type).toContain('text/html');
    expect(res.text).toContain('Share the links');
    expect(res.text).toContain('KZQ4');
    expect(res.text).toContain('Player 1 · Alex');
    expect(res.text).toContain('Waiting for everyone to join');
    // The bound boolean: canStart defaults to false, so disabled={!canStart} is on.
    expect(res.text).toMatch(/<button[^>]*disabled/);
    // The class the SSR render used is defined in an inlined stylesheet.
    const cls = /class="([^" ]+)/.exec(res.text)?.[1] ?? '';
    expect(cls).not.toBe('');
    expect(res.text).toContain(`.${cls}`);
    const theme = res.text.indexOf('--color-bg');
    const moduleCss = res.text.indexOf(`.${cls}`);
    expect(theme).toBeGreaterThan(-1);
    expect(theme).toBeLessThan(moduleCss);
    // A view preview ships no hydration script.
    expect(res.text).not.toContain('scamp-data');
    expect(res.text).toContain('/@vite/client');
  });

  it('GET /_views/<unknown> is 404, as is a lowercase or traversal name', async () => {
    expect((await get(server, '/_views/Nope')).status).toBe(404);
    expect((await get(server, '/_views/home')).status).toBe(404);
    expect((await get(server, '/_views/..%2Fpackage')).status).toBe(404);
  });

  it('GET / renders the static index route with no JavaScript beyond the Vite client', async () => {
    const res = await get(server, '/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Noise With Friends');
    expect(res.text).not.toContain('scamp-data');
    expect(res.text).not.toContain('virtual:scamp-entry');
  });

  it('GET /game/KZQ4/lobby runs load() with params and hydrates a client route', async () => {
    const res = await get(server, '/game/KZQ4/lobby');
    expect(res.status).toBe(200);
    expect(res.text).toContain('KZQ4');
    expect(res.text).toContain('1 of 2 joined');
    expect(res.text).toContain('Player 1 · Alex');
    expect(res.text).toContain(
      '<script id="scamp-data" type="application/json">',
    );
    expect(res.text).toContain('virtual:scamp-entry');
    const entry =
      /src="([^"]*virtual:scamp-entry[^"]*)"/.exec(res.text)?.[1] ?? '';
    const js = await get(server, entry);
    expect(js.status).toBe(200);
    expect(js.text).toContain('hydrate');
    expect(js.text).toContain('/routes/game/[token]/lobby.tsx');
  });

  it('serves a view module to the browser through Vite, with the @/ alias resolved', async () => {
    const res = await get(server, '/views/Lobby/Lobby.tsx');
    expect(res.status).toBe(200);
    expect(res.text).toContain('/components/LinkCard/LinkCard.tsx');
    expect(res.text).not.toContain("from '@/");
  });

  it('POST /api/games/KZQ4/start runs the plain handler with params and env', async () => {
    const res = await fetch(`${server.url}/api/games/KZQ4/start`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      game: { token: 'KZQ4', started: true },
    });
    const wrong = await fetch(`${server.url}/api/games/KZQ4/start`);
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get('allow')).toBe('POST');
  });

  it('GET /api/health and its sub-path come from the default Hono app', async () => {
    expect(await (await fetch(`${server.url}/api/health`)).json()).toEqual({
      ok: true,
    });
    expect(await (await fetch(`${server.url}/api/health/deep`)).text()).toBe(
      'deep',
    );
    expect((await fetch(`${server.url}/api/nope`)).status).toBe(404);
  });

  it('GET of an unknown path is 404', async () => {
    expect((await get(server, '/nope')).status).toBe(404);
    expect((await get(server, '/game')).status).toBe(404);
  });
});

describe('scamp dev on a scaffolded project', () => {
  let server: DevServer;
  beforeAll(async () => {
    rmSync(tmp, { recursive: true, force: true });
    for (const [file, content] of Object.entries(
      projectTemplate({ name: 'scaffold' }),
    )) {
      mkdirSync(dirname(join(tmp, file)), { recursive: true });
      writeFileSync(join(tmp, file), content);
    }
    writeFileSync(join(tmp, '.dev.vars'), 'GREETING=hello from .dev.vars\n');
    writeFileSync(
      join(tmp, 'routes', 'hello.tsx'),
      [
        "import type { LoadContext, RouteProps } from 'scampjs/runtime';",
        "import { useParams } from 'scampjs/runtime';",
        '',
        "export const render = 'server';",
        '',
        'export function load({ env, request }: LoadContext) {',
        "  const greeting = (env as unknown as Record<string, string>)['GREETING'];",
        '  return { greeting, url: new URL(request.url).pathname };',
        '}',
        '',
        'export default function Hello({ data }: RouteProps<typeof load>) {',
        '  const params = useParams();',
        '  return <p>{data.greeting} at {data.url} with {Object.keys(params).length} params</p>;',
        '}',
        '',
      ].join('\n'),
    );
    server = await createDevServer({ root: tmp, stdout: quiet, stderr: quiet });
  }, 30_000);
  afterAll(async () => {
    await server.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('renders the scaffolded Home at /', async () => {
    const res = await get(server, '/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('data-scamp-id="root"');
    expect(JSON.parse((await get(server, '/_views/')).text)).toEqual({
      views: ['Home'],
    });
  });

  it('load() reads env from .dev.vars and the standard Request, and useParams works on the server', async () => {
    const res = await get(server, '/hello');
    expect(res.status).toBe(200);
    expect(res.text).toContain('hello from .dev.vars at /hello with 0 params');
  });

  it('reports a route error as 500 with the message', async () => {
    writeFileSync(
      join(tmp, 'routes', 'broken.tsx'),
      'export default function Broken() { throw new Error("kaboom"); }\n',
    );
    // The route table is rescanned when a file appears; the watcher is
    // asynchronous, so poll briefly.
    let res = await get(server, '/broken');
    for (let i = 0; i < 40 && res.status === 404; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
      res = await get(server, '/broken');
    }
    expect(res.status).toBe(500);
    expect(res.text).toContain('kaboom');
  });
});

describe('scamp dev with the Drizzle recipe on SQLite', () => {
  // The recipe's own lib/db.ts against a file database, through a
  // route's load() and an API POST: what "runs locally on SQLite with
  // no code change" means. The table is created by the route so the
  // test needs no drizzle-kit run.
  const dbTmp = resolve(import.meta.dirname, '.tmp', 'sqlite-recipe');
  let server: DevServer;
  beforeAll(async () => {
    rmSync(dbTmp, { recursive: true, force: true });
    const base = projectTemplate({ name: 'sqlite-recipe' });
    const files = { ...base, ...applyRecipe(base, drizzleRecipe('sqlite')) };
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dbTmp, file)), { recursive: true });
      writeFileSync(join(dbTmp, file), content);
    }
    writeFileSync(
      join(dbTmp, 'routes', 'items.tsx'),
      [
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
        "  await d.insert(items).values({ title: 'first' });",
        '  const rows = await d.select().from(items);',
        '  return { count: rows.length, first: rows[0]?.title ?? null };',
        '}',
        '',
        'export default function Items({ data }: RouteProps<typeof load>) {',
        '  return <p>{data.count} items, first is {data.first}</p>;',
        '}',
        '',
      ].join('\n'),
    );
    mkdirSync(join(dbTmp, 'routes', 'api'), { recursive: true });
    writeFileSync(
      join(dbTmp, 'routes', 'api', 'items.ts'),
      [
        "import type { ApiHandler } from 'scampjs/runtime';",
        "import { db } from '@/lib/db';",
        "import { items } from '@/db/schema';",
        '',
        'export const POST: ApiHandler = async ({ request, env }) => {',
        '  const title = await request.text();',
        '  const [row] = await db(env).insert(items).values({ title }).returning();',
        '  return Response.json({ id: row?.id ?? null, title: row?.title ?? null });',
        '};',
        '',
      ].join('\n'),
    );
    // libsql resolves a relative file URL against the process, not the
    // project; scamp dev runs from the project root, this test does not.
    writeFileSync(
      join(dbTmp, '.dev.vars'),
      `DATABASE_URL=file:${join(dbTmp, 'dev.db')}\n`,
    );
    server = await createDevServer({
      root: dbTmp,
      stdout: quiet,
      stderr: quiet,
    });
  }, 60_000);
  afterAll(async () => {
    await server.close();
    rmSync(dbTmp, { recursive: true, force: true });
  });

  it('load() reads through db(env) with DATABASE_URL from .dev.vars', async () => {
    const res = await get(server, '/items');
    expect(res.status, res.text).toBe(200);
    expect(res.text).toContain('1 items, first is first');
    expect(existsSync(join(dbTmp, 'dev.db'))).toBe(true);
  });

  it('an API POST writes through the same client', async () => {
    const res = await fetch(`${server.url}/api/items`, {
      method: 'POST',
      body: 'second',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: 'second' });
    expect((await get(server, '/items')).text).toContain('3 items');
  });
});
