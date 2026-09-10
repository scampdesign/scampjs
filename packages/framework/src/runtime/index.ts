/**
 * `scampjs/runtime` — the types a route file and a view file are written
 * against. Contract 0 ships types only; the runtime helpers (`Link`,
 * `useParams`, `navigate`) arrive with contract 1.
 *
 * Nothing here imports Preact, Vite, or Hono. A route file that imports
 * from this module stays portable to any other framework with one
 * wrapper, which is the portability promise in CONTRACT.md.
 */

/**
 * Bindings and secrets available to `load()` and API handlers. Each
 * deploy adapter fills it: Cloudflare from Worker bindings, Node from
 * `process.env` plus adapter config. Empty by default; a project
 * augments it in `scamp-env.d.ts`:
 *
 *   declare module 'scampjs/runtime' {
 *     interface Env { DB: D1Database }
 *   }
 *
 * An interface rather than a type because declaration merging is the
 * whole point.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type
export interface Env {}

/** Route params, as matched from `[param]` and `[...rest]` segments. */
export type Params = Record<string, string>;

/**
 * What `load()` receives. Never a Hono context: `request` is the
 * standard `Request`, and `env` is the adapter-filled `Env`.
 */
export type LoadContext<P extends Params = Params> = {
  params: P;
  request: Request;
  env: Env;
};

/**
 * Props of a route's default export. `data` is the awaited return of the
 * route's `load()`, or `undefined` when the route has none:
 *
 *   export default function Page({ params, data }: RouteProps<typeof load>)
 */
export type RouteProps<L = undefined> = {
  params: Params;
  data: L extends (...args: never[]) => infer R ? Awaited<R> : undefined;
};

/**
 * The per-route rendering mode, exported as `export const render`.
 * Default is `static`.
 */
export type RenderMode = 'static' | 'server' | 'client';

/**
 * The `_scamp` export every view and component carries. `contract` is
 * the contract version the file was written for; `events` lists the
 * props that are event handlers, which is how the build decides which
 * views need JavaScript at all.
 */
export type ViewMeta = {
  readonly contract: number;
  readonly events: readonly string[];
};
