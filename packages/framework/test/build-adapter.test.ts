import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BuildError, buildProject } from '../src/build/build.js';
import { decide } from '../src/build/plan.js';
import { projectTemplate } from '../src/templates/index.js';

// A build with an adapter: the server bundle exists, server routes and
// API routes answer per request from it, static routes still prerender.
// The adapter here is a stand-in for Node that copies the bundle into
// dist/, so the test can import it and call the Hono app directly.

const TMP = resolve(import.meta.dirname, '.tmp');
const quiet = { write: (): boolean => true };

const FAKE_ADAPTER = `export default {
  name: 'fake-node',
  serverTarget: 'node',
  async build(ctx) {
    const { copyFile, writeFile } = await import('node:fs/promises');
    await copyFile(ctx.serverEntry, ctx.outDir + '/server.js');
    await writeFile(ctx.outDir + '/adapter.json', JSON.stringify({ name: ctx.projectName, routes: ctx.routes }));
    ctx.log('fake adapter laid out ' + ctx.routes.length + ' routes');
  },
};
`;

const scaffold = (name: string, extra: Record<string, string>): string => {
  const dir = join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  const files = projectTemplate({ name, scampjsVersion: '^0.3.0' });
  const pkg = JSON.parse(files['package.json'] ?? '{}') as Record<
    string,
    unknown
  >;
  pkg['scamp'] = { adapter: '@test/adapter' };
  pkg['dependencies'] = {
    ...(pkg['dependencies'] as Record<string, string>),
    '@test/adapter': '*',
  };
  files['package.json'] = JSON.stringify(pkg, null, 2);
  for (const [file, content] of Object.entries({ ...files, ...extra })) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  // The adapter, installed as the project would install it.
  mkdirSync(join(dir, 'node_modules', '@test', 'adapter'), { recursive: true });
  writeFileSync(
    join(dir, 'node_modules', '@test', 'adapter', 'package.json'),
    JSON.stringify({ name: '@test/adapter', type: 'module', main: 'index.js' }),
  );
  writeFileSync(
    join(dir, 'node_modules', '@test', 'adapter', 'index.js'),
    FAKE_ADAPTER,
  );
  return dir;
};

type HonoLike = {
  fetch: (request: Request, env?: unknown) => Promise<Response> | Response;
};

describe('decide with an adapter', () => {
  it('renders server routes and un-enumerated dynamic routes per request instead of refusing', () => {
    expect(
      decide(
        { mode: 'server', dynamic: false, hasLoad: true, hasParams: false },
        { adapter: true },
      ),
    ).toEqual({ kind: 'server' });
    expect(
      decide(
        { mode: 'client', dynamic: true, hasLoad: true, hasParams: false },
        { adapter: true },
      ),
    ).toEqual({ kind: 'server' });
    expect(
      decide(
        { mode: 'static', dynamic: true, hasLoad: true, hasParams: true },
        { adapter: true },
      ),
    ).toEqual({ kind: 'prerender', enumerate: true });
    expect(
      decide(
        { mode: 'static', dynamic: false, hasLoad: false, hasParams: false },
        { adapter: true },
      ),
    ).toEqual({ kind: 'prerender', enumerate: false });
  });
});

describe('scamp build with an adapter', () => {
  let dir: string;
  let app: HonoLike;
  beforeAll(async () => {
    dir = scaffold('build-adapter', {
      '.dev.vars': 'GREETING=from-dev-vars\n',
      'routes/account.tsx': `import type { LoadContext, RouteProps } from 'scampjs/runtime';

export const render = 'server';

export function load({ env, request }: LoadContext) {
  const e = env as unknown as Record<string, string>;
  return { who: e['USER_NAME'] ?? 'nobody', path: new URL(request.url).pathname };
}

export default function Account({ data }: RouteProps<typeof load>) {
  return <p id="who">{data.who} at {data.path}</p>;
}
`,
      'routes/game/[token].tsx': `import type { LoadContext, RouteProps } from 'scampjs/runtime';

export function load({ params }: LoadContext<{ token: string }>) {
  return { token: params.token };
}

export default function Game({ data }: RouteProps<typeof load>) {
  return <h1>game {data.token}</h1>;
}
`,
      'routes/api/echo.ts': `import type { ApiHandler } from 'scampjs/runtime';

export const POST: ApiHandler = async ({ request, env }) => {
  const e = env as unknown as Record<string, string>;
  return Response.json({ body: await request.text(), user: e['USER_NAME'] ?? null });
};
`,
      'routes/api/health.ts': `import { Hono } from 'hono';

export default new Hono().get('/', (c) => c.json({ ok: true }));
`,
    });
    const result = await buildProject({ root: dir, stderr: quiet });
    expect(result.adapter).toBe('fake-node');
    const mod = (await import(
      pathToFileURL(join(dir, 'dist', 'server.js')).href
    )) as { default: HonoLike };
    app = mod.default;
  }, 180_000);
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('prerenders the static route and leaves the server ones to the bundle', () => {
    expect(existsSync(join(dir, 'dist', 'index.html'))).toBe(true);
    expect(existsSync(join(dir, 'dist', 'account'))).toBe(false);
    expect(existsSync(join(dir, 'dist', 'server.js'))).toBe(true);
    const laid = JSON.parse(
      readFileSync(join(dir, 'dist', 'adapter.json'), 'utf8'),
    ) as {
      name: string;
      routes: Array<{ file: string; perRequest: boolean; pages: string[] }>;
    };
    expect(laid.name).toBe('build-adapter');
    expect(laid.routes.find((r) => r.file === 'account.tsx')).toMatchObject({
      perRequest: true,
      pages: [],
    });
    expect(laid.routes.find((r) => r.file === 'index.tsx')).toMatchObject({
      perRequest: false,
      pages: ['/'],
    });
  });

  it('serves a server route per request with the host env and the stylesheet links', async () => {
    const res = await app.fetch(new Request('http://localhost/account'), {
      USER_NAME: 'alex',
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('alex at /account');
    expect(html).toMatch(/<link rel="stylesheet" href="\/assets\/[^"]+\.css">/);
    expect(html).not.toContain('<script');
  });

  it('serves a dynamic route with no params() per request', async () => {
    const html = await (
      await app.fetch(new Request('http://localhost/game/KZQ4'), {})
    ).text();
    expect(html).toContain('game KZQ4');
  });

  it('answers API routes of both shapes from the bundle', async () => {
    const echo = await app.fetch(
      new Request('http://localhost/api/echo', { method: 'POST', body: 'hi' }),
      { USER_NAME: 'bea' },
    );
    expect(await echo.json()).toEqual({ body: 'hi', user: 'bea' });
    expect(
      (await app.fetch(new Request('http://localhost/api/echo'), {})).status,
    ).toBe(405);
    expect(
      await (
        await app.fetch(new Request('http://localhost/api/health'), {})
      ).json(),
    ).toEqual({ ok: true });
    expect(
      (await app.fetch(new Request('http://localhost/api/nope'), {})).status,
    ).toBe(404);
  });

  it('still serves a prerendered route from the bundle when the host asks it to', async () => {
    const html = await (
      await app.fetch(new Request('http://localhost/'), {})
    ).text();
    expect(html).toContain('data-scamp-id="root"');
  });
});

describe('scamp build without an adapter', () => {
  it('refuses API routes and says how to add an adapter', async () => {
    const dir = join(TMP, 'build-no-adapter');
    rmSync(dir, { recursive: true, force: true });
    for (const [file, content] of Object.entries({
      ...projectTemplate({ name: 'x', scampjsVersion: '^0.3.0' }),
      'routes/api/ping.ts': 'export const GET = () => new Response("pong");\n',
    })) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), content);
    }
    try {
      const failure = await buildProject({ root: dir, stderr: quiet }).then(
        () => null,
        (e: unknown) => e,
      );
      expect(failure).toBeInstanceOf(BuildError);
      expect(failure instanceof Error ? failure.message : '').toContain('"adapter"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
