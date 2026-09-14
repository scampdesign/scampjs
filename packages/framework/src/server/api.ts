/**
 * Dispatch one request to an API route module (CONTRACT.md section 1.5,
 * API handlers). Two shapes: named method exports over `LoadContext`
 * returning a `Response`, or a default-exported Hono app mounted at the
 * file's path. Shared by the dev server and the built server.
 */
import { Hono } from 'hono';
import type { Env, LoadContext, Params } from '../runtime/index.js';
import { matchRoutePrefixes } from '../dev/routes.js';
import type { RouteEntry, Segment } from '../dev/routes.js';

export const API_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
] as const;
export type ApiMethod = (typeof API_METHODS)[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** A Hono app, recognised by its `fetch` and `route` methods rather than its class. */
const isHonoApp = (value: unknown): value is Hono =>
  isRecord(value) &&
  typeof value['fetch'] === 'function' &&
  typeof value['route'] === 'function';

/** The mount path of an API file: its static prefix up to the first param. Hono keeps the params. */
export const mountPath = (segments: ReadonlyArray<Segment>): string =>
  `/${segments
    .map((s) =>
      s.kind === 'static'
        ? s.value
        : s.kind === 'param'
          ? `:${s.name}`
          : `:${s.name}{.+}`,
    )
    .join('/')}`;

export type ApiDispatchInput = {
  module: unknown;
  /** The file's segments, for a Hono app's mount path. */
  segments: ReadonlyArray<Segment>;
  params: Params;
  request: Request;
  env: Record<string, unknown>;
  /** The file, for error messages. */
  file: string;
};

/** Run the handler the request's method names, or the mounted Hono app. */
export const dispatchApi = async (
  input: ApiDispatchInput,
): Promise<Response> => {
  const { module, request } = input;
  if (!isRecord(module)) {
    throw new Error(`routes/${input.file} did not load as a module.`);
  }
  const app = module['default'];
  if (isHonoApp(app)) {
    // Mount at the file's path so the app's own routes are relative to it,
    // as they would be under `app.route()`; params stay visible to it.
    return new Hono()
      .route(mountPath(input.segments), app)
      .fetch(request, input.env);
  }
  const method = request.method.toUpperCase();
  const handler = module[method];
  if (typeof handler === 'function') {
    const ctx: LoadContext = {
      params: input.params,
      request,
      env: input.env as unknown as Env,
    };
    const result: unknown = await (handler as (c: LoadContext) => unknown)(ctx);
    if (!(result instanceof Response)) {
      throw new Error(
        `routes/${input.file}: ${method} must return a Response.`,
      );
    }
    return result;
  }
  if (method === 'HEAD' && typeof module['GET'] === 'function') {
    const ctx: LoadContext = {
      params: input.params,
      request,
      env: input.env as unknown as Env,
    };
    const result: unknown = await (
      module['GET'] as (c: LoadContext) => unknown
    )(ctx);
    if (result instanceof Response)
      return new Response(null, {
        status: result.status,
        headers: result.headers,
      });
  }
  const allowed = API_METHODS.filter((m) => typeof module[m] === 'function');
  if (allowed.length === 0) {
    throw new Error(
      `routes/${input.file} exports no handler: export GET, POST, …, or a default Hono app.`,
    );
  }
  return new Response('Method not allowed', {
    status: 405,
    headers: { allow: allowed.join(', ') },
  });
};

/**
 * Answer an `/api/…` request from the API route table: the exact match
 * first, then, for a default-exported Hono app, the longest file whose
 * path is a prefix of the request's. `load` brings in a module by its
 * file; the dev server and the built server supply their own.
 */
export const handleApiRequest = async (
  routes: ReadonlyArray<RouteEntry>,
  request: Request,
  env: Record<string, unknown>,
  load: (file: string) => Promise<unknown>,
): Promise<Response | null> => {
  const pathname = new URL(request.url).pathname;
  for (const candidate of matchRoutePrefixes(routes, pathname)) {
    const module = await load(candidate.route.file);
    const isApp = isRecord(module) && isHonoApp(module['default']);
    if (!candidate.exact && !isApp) continue;
    return dispatchApi({
      module,
      segments: candidate.route.segments,
      params: candidate.params,
      request,
      env,
      file: candidate.route.file,
    });
  }
  return null;
};
