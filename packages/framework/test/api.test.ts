import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  apiRouteSegments,
  compareRoutes,
  matchRoutePrefixes,
  scanApiRoutes,
} from '../src/dev/routes.js';
import { dispatchApi, handleApiRequest, mountPath } from '../src/server/api.js';

const segs = (file: string): ReturnType<typeof apiRouteSegments> =>
  apiRouteSegments(file);

describe('apiRouteSegments', () => {
  it('keeps the api prefix and reads params like a page route', () => {
    expect(segs('api/games/[token]/start.ts')).toEqual([
      { kind: 'static', value: 'api' },
      { kind: 'static', value: 'games' },
      { kind: 'param', name: 'token' },
      { kind: 'static', value: 'start' },
    ]);
    expect(segs('api/index.ts')).toEqual([{ kind: 'static', value: 'api' }]);
  });

  it('is null outside api/ and for non-code files', () => {
    expect(segs('index.tsx')).toBeNull();
    expect(segs('api/notes.md')).toBeNull();
  });
});

describe('matchRoutePrefixes', () => {
  const routes = scanApiRoutesFrom([
    'api/health.ts',
    'api/games/[token]/start.ts',
    'api/[...rest].ts',
  ]);
  it('puts the exact match first, then longer prefixes', () => {
    const found = matchRoutePrefixes(routes, '/api/health/deep');
    expect(found.map((m) => [m.route.file, m.exact, m.consumed])).toEqual([
      ['api/[...rest].ts', true, 3],
      ['api/health.ts', false, 2],
    ]);
    expect(
      matchRoutePrefixes(routes, '/api/games/KZQ4/start')[0],
    ).toMatchObject({
      route: { file: 'api/games/[token]/start.ts' },
      params: { token: 'KZQ4' },
      exact: true,
    });
  });
});

const ctx = (method: string, path: string, body?: string): Request =>
  new Request(`http://localhost${path}`, { method, body });

describe('dispatchApi', () => {
  const plain = {
    GET: ({ params }: { params: Record<string, string> }) =>
      Response.json({ token: params['token'] }),
    POST: async ({ request }: { request: Request }) =>
      new Response(await request.text(), { status: 201 }),
  };
  const segments = segs('api/games/[token]/start.ts') ?? [];

  it('calls the named handler for the method with a LoadContext', async () => {
    const res = await dispatchApi({
      module: plain,
      segments,
      params: { token: 'KZQ4' },
      request: ctx('GET', '/api/games/KZQ4/start'),
      env: { DB: 'x' },
      file: 'x.ts',
    });
    expect(await res.json()).toEqual({ token: 'KZQ4' });
    const post = await dispatchApi({
      module: plain,
      segments,
      params: {},
      request: ctx('POST', '/api/games/KZQ4/start', 'hi'),
      env: {},
      file: 'x.ts',
    });
    expect(post.status).toBe(201);
    expect(await post.text()).toBe('hi');
  });

  it('answers 405 with Allow for a method the file does not export', async () => {
    const res = await dispatchApi({
      module: plain,
      segments,
      params: {},
      request: ctx('DELETE', '/x'),
      env: {},
      file: 'x.ts',
    });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, POST');
  });

  it('serves HEAD from GET when there is no HEAD', async () => {
    const res = await dispatchApi({
      module: plain,
      segments,
      params: { token: 't' },
      request: ctx('HEAD', '/x'),
      env: {},
      file: 'x.ts',
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('mounts a default Hono app at the file path, sub-paths and params included', async () => {
    const app = new Hono()
      .get('/', (c) => c.json({ token: c.req.param('token') }))
      .get('/deep', (c) => c.text('deep'));
    const res = await dispatchApi({
      module: { default: app },
      segments,
      params: {},
      request: ctx('GET', '/api/games/KZQ4/start'),
      env: {},
      file: 'x.ts',
    });
    expect(await res.json()).toEqual({ token: 'KZQ4' });
    const deep = await dispatchApi({
      module: { default: app },
      segments,
      params: {},
      request: ctx('GET', '/api/games/KZQ4/start/deep'),
      env: {},
      file: 'x.ts',
    });
    expect(await deep.text()).toBe('deep');
  });

  it('rejects a handler that returns something other than a Response, and a file with no handler', async () => {
    await expect(
      dispatchApi({
        module: { GET: () => ({ nope: true }) },
        segments,
        params: {},
        request: ctx('GET', '/x'),
        env: {},
        file: 'x.ts',
      }),
    ).rejects.toThrow('must return a Response');
    await expect(
      dispatchApi({
        module: { helper: 1 },
        segments,
        params: {},
        request: ctx('GET', '/x'),
        env: {},
        file: 'x.ts',
      }),
    ).rejects.toThrow('exports no handler');
  });

  it('mountPath writes Hono param syntax', () => {
    expect(mountPath(segments)).toBe('/api/games/:token/start');
    expect(mountPath(segs('api/[...rest].ts') ?? [])).toBe('/api/:rest{.+}');
  });
});

describe('handleApiRequest', () => {
  it('prefers the exact file and falls back to a Hono app on a prefix', async () => {
    const routes = scanApiRoutesFrom(['api/health.ts', 'api/health/exact.ts']);
    const modules: Record<string, unknown> = {
      'api/health.ts': {
        default: new Hono()
          .get('/', (c) => c.text('root'))
          .get('/deep', (c) => c.text('deep')),
      },
      'api/health/exact.ts': { GET: () => new Response('exact') },
    };
    const load = (file: string): Promise<unknown> =>
      Promise.resolve(modules[file]);
    expect(
      await (
        await handleApiRequest(
          routes,
          ctx('GET', '/api/health/exact'),
          {},
          load,
        )
      )?.text(),
    ).toBe('exact');
    expect(
      await (
        await handleApiRequest(routes, ctx('GET', '/api/health/deep'), {}, load)
      )?.text(),
    ).toBe('deep');
    expect(
      await (
        await handleApiRequest(routes, ctx('GET', '/api/health'), {}, load)
      )?.text(),
    ).toBe('root');
    expect(
      await handleApiRequest(routes, ctx('GET', '/api/nope'), {}, load),
    ).toBeNull();
  });
});

function scanApiRoutesFrom(files: string[]): ReturnType<typeof scanApiRoutes> {
  // The same order the scanner produces: most specific first.
  return files
    .map((file) => ({ file, segments: apiRouteSegments(file) ?? [] }))
    .sort(compareRoutes);
}
