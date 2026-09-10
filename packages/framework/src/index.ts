/**
 * The contract version this package implements. Mirrors the
 * `scampjs.contract` key in package.json; a test keeps the two equal.
 * See CONTRACT.md at the repository root for what each version means.
 */
export const CONTRACT_VERSION = 0 as const;

export type {
  Env,
  LoadContext,
  Params,
  RenderMode,
  RouteProps,
  ViewMeta,
} from './runtime/index.js';
