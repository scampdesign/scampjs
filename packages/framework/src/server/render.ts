/**
 * Render one page route: run `load()`, render the component with the
 * params in scope, and wrap the markup in the document shell. Shared by
 * the dev server (styles inlined, Vite's client script) and the built
 * server (stylesheet links, the hydration entry from the manifest).
 */
import { h } from 'preact';
import type { ComponentType } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { documentShell } from '../dev/shell.js';
import type { Env, LoadContext, Params, RenderMode } from '../runtime/index.js';
import { withParams } from '../runtime/params.js';

export type RouteModuleShape = {
  component: ComponentType<{ params: Params; data: unknown }>;
  load: ((ctx: LoadContext) => unknown) | null;
  params: (() => Params[] | Promise<Params[]>) | null;
  render: RenderMode;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFunction = (value: unknown): value is (...args: never[]) => unknown =>
  typeof value === 'function';

/** Read a route module's exports, refusing the shapes the contract rules out. */
export const routeModuleShape = (
  mod: unknown,
  name: string,
): RouteModuleShape => {
  if (!isRecord(mod) || !isFunction(mod['default'])) {
    throw new Error(
      `${name} has no default export; a route file exports a component.`,
    );
  }
  const render = mod['render'];
  if (
    render !== undefined &&
    render !== 'static' &&
    render !== 'server' &&
    render !== 'client'
  ) {
    throw new Error(`${name}: render must be 'static', 'server', or 'client'.`);
  }
  return {
    component: mod['default'] as ComponentType<{
      params: Params;
      data: unknown;
    }>,
    load: isFunction(mod['load'])
      ? (mod['load'] as (ctx: LoadContext) => unknown)
      : null,
    params: isFunction(mod['params'])
      ? (mod['params'] as () => Params[] | Promise<Params[]>)
      : null,
    render: render ?? 'static',
  };
};

export type PageRenderInput = {
  route: RouteModuleShape;
  title: string;
  params: Params;
  request: Request;
  env: Record<string, unknown>;
  /** Inlined `<style>` blocks (dev). */
  styles?: ReadonlyArray<string>;
  /** `<link rel="stylesheet">` hrefs (build). */
  links?: ReadonlyArray<string>;
  /** Scripts to load regardless of hydration, e.g. Vite's client in dev. */
  baseScripts?: ReadonlyArray<string>;
  /** The hydration entry, loaded only when the route ships JavaScript. */
  entry: string | null;
  /** Whether this route ships JavaScript; the page then carries its data. */
  javascript: boolean;
};

/** The HTML for one page. */
export const renderPage = async (input: PageRenderInput): Promise<string> => {
  const ctx: LoadContext = {
    params: input.params,
    request: input.request,
    env: input.env as unknown as Env,
  };
  const data: unknown =
    input.route.load === null ? undefined : await input.route.load(ctx);
  const body = withParams(input.params, () =>
    renderToString(h(input.route.component, { params: input.params, data })),
  );
  const scripts = [
    ...(input.baseScripts ?? []),
    ...(input.javascript && input.entry !== null ? [input.entry] : []),
  ];
  return documentShell({
    title: input.title,
    styles: input.styles ?? [],
    links: input.links ?? [],
    body,
    scripts,
    data: input.javascript
      ? JSON.stringify({ params: input.params, data })
      : undefined,
  });
};

/** A route file's display title: its path without the extension. */
export const routeTitle = (file: string): string =>
  file.replace(/\.(tsx|jsx|ts|js)$/, '');
