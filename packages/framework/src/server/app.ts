/**
 * The built server: a Hono app over the project's routes, made from the
 * route table `scamp build` writes into the server entry. Runs wherever
 * an adapter puts it; `env` is whatever the host hands `fetch()`.
 * see docs/notes/server.md
 */
import { Hono } from 'hono';
import type { RouteEntry, Segment } from '../dev/routes.js';
import { matchRoute } from '../dev/routes.js';
import type { RenderMode } from '../runtime/index.js';
import { handleApiRequest } from './api.js';
import { renderPage, routeModuleShape, routeTitle } from './render.js';

export type ServerRoute = {
  file: string;
  segments: Segment[];
  mode: RenderMode;
  /** The route module, imported statically by the server entry. */
  module: unknown;
  /** `<link rel="stylesheet">` hrefs, theme first. */
  stylesheets: string[];
  /** The hydration entry's URL when the route ships JavaScript. */
  script: string | null;
};

export type ServerApi = {
  file: string;
  segments: Segment[];
  module: unknown;
};

export type ServerAppOptions = {
  routes: ServerRoute[];
  api: ServerApi[];
};

const asEnv = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};

export const createServerApp = (opts: ServerAppOptions): Hono => {
  const app = new Hono();
  const apiTable: RouteEntry[] = opts.api.map((a) => ({
    file: a.file,
    segments: a.segments,
  }));
  const apiModules = new Map(opts.api.map((a) => [a.file, a.module]));
  const pageTable: RouteEntry[] = opts.routes.map((r) => ({
    file: r.file,
    segments: r.segments,
  }));
  const pages = new Map(opts.routes.map((r) => [r.file, r]));

  app.all('*', async (c) => {
    const path = c.req.path;
    const env = asEnv(c.env);
    if (path === '/api' || path.startsWith('/api/')) {
      const answer = await handleApiRequest(apiTable, c.req.raw, env, (file) =>
        Promise.resolve(apiModules.get(file)),
      );
      return answer ?? c.text('Not found', 404);
    }
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD')
      return c.text('Method not allowed', 405);
    const match = matchRoute(pageTable, path);
    const page = match === null ? undefined : pages.get(match.route.file);
    if (match === null || page === undefined) return c.text('Not found', 404);
    const html = await renderPage({
      route: routeModuleShape(page.module, `routes/${page.file}`),
      title: routeTitle(page.file),
      params: match.params,
      request: c.req.raw,
      env,
      links: page.stylesheets,
      entry: page.script,
      javascript: page.script !== null,
    });
    return c.html(html);
  });
  return app;
};
