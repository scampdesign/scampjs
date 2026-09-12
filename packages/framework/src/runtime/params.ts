/**
 * The route params in scope, shared through a global keyed by symbol
 * rather than a module variable: the renderer (this package, loaded by
 * Node) and the route file (loaded by Vite's SSR runner, and in the
 * browser by the hydration entry) are different module instances of
 * `scampjs/runtime`, and a symbol-keyed global is the one thing all
 * three see. Rendering is synchronous, so a set-render-clear window is
 * safe on the server.
 */
import type { Params } from './index.js';

const KEY = Symbol.for('scampjs.params');

type Holder = { [KEY]?: Params | null };

export const currentParams = (): Params => (globalThis as Holder)[KEY] ?? {};

export const setCurrentParams = (params: Params | null): void => {
  (globalThis as Holder)[KEY] = params;
};

/** Run `fn` with `params` in scope for `useParams()`. */
export const withParams = <T>(params: Params, fn: () => T): T => {
  setCurrentParams(params);
  try {
    return fn();
  } finally {
    setCurrentParams(null);
  }
};
