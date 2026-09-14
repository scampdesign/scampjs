/**
 * The framework's own settings live under the `scamp` key of the
 * project's package.json: declarative, and readable by the Scamp app
 * without a config file it would have to ignore.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isAdapter } from '../adapter/index.js';
import type { Adapter } from '../adapter/index.js';

export type ScampConfig = {
  /** The adapter package to build for, e.g. `@scampjs/adapter-cloudflare`. */
  adapter?: string;
};

export type PackageInfo = { name: string; config: ScampConfig };

/** Read `name` and the `scamp` key; a missing or malformed file is an error the caller reports. */
export const readPackageInfo = (root: string): PackageInfo => {
  const parsed: unknown = JSON.parse(
    readFileSync(join(root, 'package.json'), 'utf8'),
  );
  const pkg =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  const scamp =
    typeof pkg['scamp'] === 'object' && pkg['scamp'] !== null
      ? (pkg['scamp'] as Record<string, unknown>)
      : {};
  const adapter = scamp['adapter'];
  if (adapter !== undefined && typeof adapter !== 'string') {
    throw new Error('package.json: "scamp.adapter" must be a package name.');
  }
  return {
    name: typeof pkg['name'] === 'string' ? pkg['name'] : 'scamp-project',
    config: adapter === undefined ? {} : { adapter },
  };
};

/** Import the adapter from the project's own dependencies. */
export const loadAdapter = async (
  root: string,
  specifier: string,
): Promise<Adapter> => {
  const require = createRequire(join(root, 'package.json'));
  let resolved: string;
  try {
    resolved = require.resolve(specifier);
  } catch {
    throw new Error(
      `Adapter "${specifier}" is not installed; add it to package.json and run npm install.`,
    );
  }
  const mod: unknown = await import(pathToFileURL(resolved).href);
  const candidate =
    typeof mod === 'object' && mod !== null && 'default' in mod
      ? mod.default
      : mod;
  if (!isAdapter(candidate)) {
    throw new Error(
      `"${specifier}" does not export an adapter (name, serverTarget, build).`,
    );
  }
  return candidate;
};
