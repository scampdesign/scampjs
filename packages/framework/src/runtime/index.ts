/**
 * `scampjs/runtime` — what a route file imports. Types for `load()` and
 * the route component, plus three helpers: `Link`, `useParams`, and
 * `navigate`. Views import nothing from here; that is the portability
 * promise in CONTRACT.md.
 *
 * Preact is the only import. Nothing here touches Vite or Hono.
 */
import { h } from 'preact';
import type { ComponentChildren, JSX } from 'preact';
import { currentParams } from './params.js';

/**
 * Bindings and secrets available to `load()` and API handlers. Each
 * deploy adapter fills it; the dev server fills it from `.dev.vars`
 * and `process.env`. Empty by default; a project augments it in
 * `scamp-env.d.ts`:
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
 * A plain API handler: one named export per method (`GET`, `POST`, …)
 * in a file under `routes/api/`, over the same `LoadContext` as
 * `load()`, returning a standard `Response`. Needs no import.
 */
export type ApiHandler<P extends Params = Params> = (
  ctx: LoadContext<P>,
) => Response | Promise<Response>;

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

/**
 * The params of the route being rendered, on the server during render
 * and in the browser after hydration. Typed by the caller, as `load()`
 * types its own `LoadContext<P>`.
 */
export const useParams = <P extends Params = Params>(): P =>
  currentParams() as P;

/** Go to another page. A full navigation; there is no client router. */
export const navigate = (href: string): void => {
  if (typeof location !== 'undefined') location.assign(href);
};

export type LinkProps = Omit<JSX.HTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children?: ComponentChildren;
};

/** An anchor. Exists so a route file has one import for links, not a convention. */
export const Link = ({ href, children, ...rest }: LinkProps): JSX.Element =>
  h('a', { ...rest, href }, children);
