/**
 * `@scampjs/adapter-cloudflare`: lay a `scamp build` out for Cloudflare.
 * Workers with static assets is the target: `dist/` is the assets
 * directory the platform serves first (every prerendered page, the
 * stylesheets, `public/`), and `dist/_worker.js` is the server bundle
 * that answers everything else — server routes, dynamic routes, API
 * routes. Pages' advanced mode uses the same `_worker.js` inside the
 * same folder, so one build deploys to either. see docs/notes/server.md
 */
import { copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter, AdapterBuildContext } from 'scampjs/adapter';

export type CloudflareOptions = {
  /** The `compatibility_date` written into a new wrangler.jsonc. Defaults to the build day. */
  compatibilityDate?: string;
};

const today = (): string => new Date().toISOString().slice(0, 10);

/** A wrangler.jsonc for a new project; written only when the project has none. */
export const wranglerConfig = (
  projectName: string,
  compatibilityDate: string,
): string => `{
  // Written by @scampjs/adapter-cloudflare on the first build; yours from here.
  // Bindings such as a D1 database go in this file: see
  // https://developers.cloudflare.com/workers/wrangler/configuration/
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": ${JSON.stringify(projectName)},
  "main": "dist/_worker.js",
  "compatibility_date": ${JSON.stringify(compatibilityDate)},
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "dist",
    "binding": "ASSETS",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "none"
  },
  "observability": { "enabled": true }
}
`;

export const cloudflare = (options: CloudflareOptions = {}): Adapter => ({
  name: 'cloudflare',
  serverTarget: 'webworker',
  build: async (ctx: AdapterBuildContext): Promise<void> => {
    const worker = join(ctx.outDir, '_worker.js');
    await copyFile(ctx.serverEntry, worker);
    // The bundle lives inside the assets directory; keep it out of the
    // files the assets layer serves.
    await writeFile(join(ctx.outDir, '.assetsignore'), '_worker.js\n', 'utf8');
    const config = join(ctx.root, 'wrangler.jsonc');
    if (
      !existsSync(config) &&
      !existsSync(join(ctx.root, 'wrangler.toml')) &&
      !existsSync(join(ctx.root, 'wrangler.json'))
    ) {
      await writeFile(
        config,
        wranglerConfig(ctx.projectName, options.compatibilityDate ?? today()),
        'utf8',
      );
      ctx.log(`wrote wrangler.jsonc; deploy with: npx wrangler deploy`);
    }
    const perRequest = ctx.routes.filter((r) => r.perRequest).length;
    ctx.log(
      `cloudflare: dist/ as assets, dist/_worker.js answers ${perRequest} route${perRequest === 1 ? '' : 's'} per request and the API`,
    );
  },
});

export default cloudflare();
