/**
 * `scampjs/adapter` — what a deploy adapter implements. `scamp build`
 * prerenders the static pages into the output folder, bundles the
 * server into one file, and hands both to the adapter, which lays them
 * out the way its host expects. Hono runs everywhere, so an adapter is
 * a layout step, not a runtime. see docs/notes/server.md
 */
import type { RenderMode } from '../runtime/index.js';

export type AdapterRoute = {
  file: string;
  mode: RenderMode;
  /** Prerendered pages, as URL paths; empty for a route rendered per request. */
  pages: string[];
  /** Rendered per request by the server bundle. */
  perRequest: boolean;
};

export type AdapterBuildContext = {
  root: string;
  /** The static output: prerendered pages, assets, `public/`. */
  outDir: string;
  /** The bundled server entry: an ES module whose default export is the Hono app. */
  serverEntry: string;
  routes: AdapterRoute[];
  /** The project's package.json `name`, for host config the adapter writes. */
  projectName: string;
  log: (line: string) => void;
};

export type Adapter = {
  name: string;
  /** How the server bundle is built: for a Workers-style runtime or for Node. */
  serverTarget: 'webworker' | 'node';
  build: (ctx: AdapterBuildContext) => Promise<void>;
};

export const isAdapter = (value: unknown): value is Adapter =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { name?: unknown }).name === 'string' &&
  ((value as { serverTarget?: unknown }).serverTarget === 'webworker' ||
    (value as { serverTarget?: unknown }).serverTarget === 'node') &&
  typeof (value as { build?: unknown }).build === 'function';
