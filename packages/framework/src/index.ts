/**
 * The contract version this package implements. Mirrors the
 * `scampjs.contract` key in package.json; a test keeps the two equal.
 * See CONTRACT.md at the repository root for what each version means.
 */
export { CONTRACT_VERSION } from './contract.js';

export { buildProject, BuildError } from './build/build.js';
export type { BuildResult, BuiltRoute } from './build/build.js';

export type {
  Env,
  LinkProps,
  LoadContext,
  Params,
  RenderMode,
  RouteProps,
  ViewMeta,
} from './runtime/index.js';
