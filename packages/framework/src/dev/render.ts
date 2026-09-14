/**
 * Server rendering for `scamp dev`: a route with its `load()`, or a
 * view with its defaults, into the document shell with the styles the
 * module graph reached. see docs/notes/dev-server.md
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { h } from 'preact';
import type { ComponentType } from 'preact';
import { renderToString } from 'preact-render-to-string';
import type { ModuleNode, ViteDevServer } from 'vite';
import { CONTRACT_VERSION } from '../contract.js';
import type { Params } from '../runtime/index.js';
import { renderPage, routeModuleShape, routeTitle } from '../server/render.js';
import { withParams } from '../runtime/params.js';
import { documentShell } from './shell.js';
import { entryUrl } from './vitePlugin.js';
import { viewFile } from './views.js';

const VITE_CLIENT = '/@vite/client';

const isFunction = (value: unknown): value is (...args: never[]) => unknown =>
  typeof value === 'function';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** `design/theme.css` as text, or empty when the project has none. */
const themeCss = (root: string): string => {
  try {
    return readFileSync(join(root, 'design', 'theme.css'), 'utf8');
  } catch {
    return '';
  }
};

/**
 * The CSS reached from `entryFile` through the SSR module graph, as
 * text, in import order. Inlined into the page rather than linked:
 * a page with no JavaScript has no Vite client to inject styles, and
 * the parity harness wants one self-contained document.
 */
const collectCss = async (
  vite: ViteDevServer,
  entryFile: string,
): Promise<string[]> => {
  const seen = new Set<string>();
  const cssUrls: string[] = [];
  const visit = (node: ModuleNode | undefined): void => {
    if (node === undefined || node.id === null || seen.has(node.id)) return;
    seen.add(node.id);
    if (/\.css($|\?)/.test(node.id)) cssUrls.push(node.url);
    for (const child of node.ssrImportedModules) visit(child);
  };
  visit(vite.moduleGraph.getModuleById(entryFile));
  const out: string[] = [];
  for (const url of cssUrls) {
    const result = await vite.transformRequest(`${url}?direct`);
    if (result !== null) out.push(result.code);
  }
  return out;
};

export type RenderedPage = { html: string };

export type RouteRenderInput = {
  vite: ViteDevServer;
  root: string;
  /** The route file relative to `routes/`. */
  file: string;
  params: Params;
  request: Request;
  env: Record<string, string>;
};

/** Render a matched route: run `load()`, render the component, wrap it in the shell. */
export const renderRoute = async (
  input: RouteRenderInput,
): Promise<RenderedPage> => {
  const url = `/routes/${input.file}`;
  const route = routeModuleShape(await input.vite.ssrLoadModule(url), url);
  const styles = [
    themeCss(input.root),
    ...(await collectCss(input.vite, join(input.root, 'routes', input.file))),
  ];
  // In dev a `client` route hydrates as a whole; `static` and `server`
  // routes ship no JavaScript. Islands arrive with `scamp build`.
  const client = route.render === 'client';
  return {
    html: await renderPage({
      route,
      title: routeTitle(input.file),
      params: input.params,
      request: input.request,
      env: input.env,
      styles,
      baseScripts: [VITE_CLIENT],
      entry: entryUrl(url),
      javascript: client,
    }),
  };
};

/**
 * Render `views/<Name>/<Name>.tsx` with its defaults. Null when the
 * view does not exist; throws when it is written for a newer contract
 * than this package reads.
 */
export const renderView = async (
  vite: ViteDevServer,
  root: string,
  name: string,
): Promise<RenderedPage | null> => {
  const file = viewFile(root, name);
  let mod: unknown;
  try {
    mod = await vite.ssrLoadModule(`/views/${name}/${name}.tsx`);
  } catch (err) {
    if (isRecord(err) && err['code'] === 'ERR_LOAD_URL') return null;
    throw err;
  }
  if (!isRecord(mod) || !isFunction(mod['default'])) {
    throw new Error(`views/${name}/${name}.tsx has no default export.`);
  }
  const meta = mod['_scamp'];
  if (
    isRecord(meta) &&
    typeof meta['contract'] === 'number' &&
    meta['contract'] > CONTRACT_VERSION
  ) {
    throw new Error(
      `views/${name}/${name}.tsx was written for contract ${meta['contract']}; this scampjs reads up to ${CONTRACT_VERSION}. Update scampjs.`,
    );
  }
  const body = withParams({}, () =>
    renderToString(h(mod['default'] as ComponentType, {})),
  );
  const styles = [themeCss(root), ...(await collectCss(vite, file))];
  return {
    html: documentShell({ title: name, styles, body, scripts: [VITE_CLIENT] }),
  };
};
