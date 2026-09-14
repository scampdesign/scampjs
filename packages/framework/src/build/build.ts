/**
 * `scamp build`: prerender every route it can into `dist/`, a folder
 * any static host serves, and, when the project names an adapter,
 * bundle the server that answers the rest and hand both to the
 * adapter. Two Vite builds do the work — one for the server, to run
 * `load()` and render at build time, and one for the browser, for the
 * stylesheet each page links and the hydration entry a page that ships
 * JavaScript loads — then one HTML file per page. see docs/notes/build.md
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build as viteBuild } from 'vite';
import type { Plugin } from 'vite';
import type { Adapter, AdapterRoute } from '../adapter/index.js';
import { readEnv } from '../dev/env.js';
import { scanApiRoutes, scanRoutes } from '../dev/routes.js';
import type { RouteEntry } from '../dev/routes.js';
import { entryId, scampPlugin } from '../dev/vitePlugin.js';
import type { Params, RenderMode } from '../runtime/index.js';
import { renderPage, routeModuleShape, routeTitle } from '../server/render.js';
import type { RouteModuleShape } from '../server/render.js';
import { loadAdapter, readPackageInfo } from './config.js';
import {
  decide,
  eventsDeclaredIn,
  outputFile,
  pagePath,
  shipsJavaScript,
} from './plan.js';

export type BuildOptions = {
  root: string;
  /** Defaults to `<root>/dist`. */
  outDir?: string;
  stderr?: { write: (chunk: string) => unknown };
};

export type BuiltRoute = {
  file: string;
  mode: RenderMode;
  /** Prerendered pages, as URL paths. */
  pages: string[];
  /** Rendered per request by the server bundle (adapter builds only). */
  perRequest: boolean;
  javascript: boolean;
  /** Views and components under the route that declare event props. */
  eventViews: string[];
};

export type BuildResult = {
  outDir: string;
  routes: BuiltRoute[];
  /** The adapter that laid the build out, when the project names one. */
  adapter: string | null;
};

export class BuildError extends Error {
  readonly problems: ReadonlyArray<{ file: string; reason: string }>;
  constructor(problems: ReadonlyArray<{ file: string; reason: string }>) {
    super(problems.map((p) => `routes/${p.file}: ${p.reason}`).join('\n'));
    this.name = 'BuildError';
    this.problems = problems;
  }
}

const routeName = (file: string): string =>
  file.replace(/\.(tsx|jsx|ts|js)$/, '').replace(/[^A-Za-z0-9]+/g, '_') ||
  'index';

/**
 * Records, per route entry, the view and component files bundled under
 * it. Rolldown reports each chunk's modules; shared chunks are followed
 * through `imports` so a view split out for reuse still counts.
 */
const islandsPlugin = (
  root: string,
  into: Map<string, Set<string>>,
): Plugin => ({
  name: 'scamp-islands',
  generateBundle(_, bundle): void {
    const chunks = Object.values(bundle).filter((o) => o.type === 'chunk');
    const byFile = new Map(chunks.map((c) => [c.fileName, c]));
    for (const chunk of chunks) {
      if (!chunk.isEntry || chunk.facadeModuleId === null) continue;
      const modules = new Set<string>();
      const seen = new Set<string>();
      const visit = (fileName: string): void => {
        if (seen.has(fileName)) return;
        seen.add(fileName);
        const c = byFile.get(fileName);
        if (c === undefined) return;
        for (const id of Object.keys(c.modules)) {
          const rel = relative(root, id);
          if (/^(views|components)[\\/]/.test(rel) && /\.(tsx|jsx)$/.test(id))
            modules.add(id);
        }
        for (const imported of c.imports) visit(imported);
      };
      visit(chunk.fileName);
      into.set(chunk.facadeModuleId, modules);
    }
  },
});

/** A virtual module with fixed contents: the server entry. */
const virtualPlugin = (id: string, code: string): Plugin => ({
  name: `scamp-virtual:${id}`,
  resolveId: (source): string | null => (source === id ? `\0${id}` : null),
  load: (source): string | null => (source === `\0${id}` ? code : null),
});

type ManifestChunk = {
  file: string;
  css?: string[];
  imports?: string[];
  name?: string;
  isEntry?: boolean;
};
type Manifest = Record<string, ManifestChunk>;

/**
 * The stylesheets a page needs for an entry: the entry's own and those
 * of every chunk it imports, since a view shared by two routes lands in
 * a shared chunk whose CSS the manifest lists there. An entry that
 * tree-shook down to styles alone is listed as the stylesheet itself.
 */
const stylesheetsFor = (manifest: Manifest, entryKey: string): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (key: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (chunk === undefined) return;
    // The entry's own stylesheet first: it carries the theme, which the
    // contract puts before everything else.
    for (const css of chunk.css ?? []) if (!out.includes(css)) out.push(css);
    if (chunk.file.endsWith('.css') && !out.includes(chunk.file))
      out.push(chunk.file);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  visit(entryKey);
  return out;
};

type Planned = {
  route: RouteEntry;
  shape: RouteModuleShape;
  perRequest: boolean;
  eventViews: string[];
  name: string;
};

const SERVER_ENTRY = 'virtual:scamp-server';

/** The server entry: every route and API module imported statically, and the app built from them. */
const serverEntryCode = (
  planned: ReadonlyArray<
    Planned & { stylesheets: string[]; script: string | null }
  >,
  api: ReadonlyArray<RouteEntry>,
): string => {
  const lines: string[] = ["import { createServerApp } from 'scampjs/server';"];
  planned.forEach((p, i) =>
    lines.push(
      `import * as r${i} from ${JSON.stringify(`/routes/${p.route.file}`)};`,
    ),
  );
  api.forEach((a, i) =>
    lines.push(
      `import * as a${i} from ${JSON.stringify(`/routes/${a.file}`)};`,
    ),
  );
  lines.push('export default createServerApp({');
  lines.push('  routes: [');
  planned.forEach((p, i) => {
    lines.push(
      `    { file: ${JSON.stringify(p.route.file)}, segments: ${JSON.stringify(p.route.segments)}, mode: ${JSON.stringify(p.shape.render)}, module: r${i}, stylesheets: ${JSON.stringify(p.stylesheets)}, script: ${JSON.stringify(p.script)} },`,
    );
  });
  lines.push('  ],');
  lines.push('  api: [');
  api.forEach((a, i) => {
    lines.push(
      `    { file: ${JSON.stringify(a.file)}, segments: ${JSON.stringify(a.segments)}, module: a${i} },`,
    );
  });
  lines.push('  ],');
  lines.push('});');
  return `${lines.join('\n')}\n`;
};

export const buildProject = async (
  opts: BuildOptions,
): Promise<BuildResult> => {
  const root = resolve(opts.root);
  const outDir = resolve(opts.outDir ?? join(root, 'dist'));
  const stderr = opts.stderr ?? process.stderr;
  if (!existsSync(join(root, 'package.json'))) {
    throw new Error(
      `${root} has no package.json; run scamp build from the project root.`,
    );
  }
  const info = readPackageInfo(root);
  const adapter: Adapter | null =
    info.config.adapter === undefined
      ? null
      : await loadAdapter(root, info.config.adapter);
  const routes = scanRoutes(join(root, 'routes'));
  const api = scanApiRoutes(join(root, 'routes'));
  if (routes.length === 0) {
    throw new Error('routes/ has no route files; nothing to build.');
  }
  if (api.length > 0 && adapter === null) {
    throw new BuildError(
      api.map((a) => ({
        file: a.file,
        reason:
          'an API route needs a server adapter: set "scamp": { "adapter": "@scampjs/adapter-cloudflare" } in package.json.',
      })),
    );
  }
  const serverDir = join(
    root,
    'node_modules',
    '.scamp',
    `build-${process.pid}`,
  );
  await rm(serverDir, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });

  const shared = {
    root,
    configFile: false as const,
    envDir: false as const,
    logLevel: 'warn' as const,
    clearScreen: false,
  };
  const routeFile = (route: RouteEntry): string =>
    join(root, 'routes', route.file);

  // Server build: every route as an entry, run in this process below.
  const islands = new Map<string, Set<string>>();
  await viteBuild({
    ...shared,
    plugins: [scampPlugin(root), islandsPlugin(root, islands)],
    build: {
      ssr: true,
      outDir: join(serverDir, 'routes'),
      emptyOutDir: true,
      rollupOptions: {
        input: Object.fromEntries(
          routes.map((r) => [routeName(r.file), routeFile(r)]),
        ),
        output: { entryFileNames: '[name].js', format: 'es' },
      },
    },
  });

  // Read each route's exports and decide what to do with it.
  const problems: { file: string; reason: string }[] = [];
  const planned: Planned[] = [];
  for (const route of routes) {
    let shape: RouteModuleShape;
    try {
      const mod: unknown = await import(
        pathToFileURL(join(serverDir, 'routes', `${routeName(route.file)}.js`))
          .href
      );
      shape = routeModuleShape(mod, `routes/${route.file}`);
    } catch (err) {
      problems.push({
        file: route.file,
        reason: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    const decision = decide(
      {
        mode: shape.render,
        dynamic: route.segments.some((s) => s.kind !== 'static'),
        hasLoad: shape.load !== null,
        hasParams: shape.params !== null,
      },
      { adapter: adapter !== null },
    );
    if (decision.kind === 'error') {
      problems.push({ file: route.file, reason: decision.reason });
      continue;
    }
    const eventViews: string[] = [];
    for (const id of islands.get(routeFile(route)) ?? []) {
      const events = eventsDeclaredIn(await readFile(id, 'utf8'));
      if (events !== null && events.length > 0)
        eventViews.push(relative(root, id));
    }
    planned.push({
      route,
      shape,
      perRequest: decision.kind === 'server',
      eventViews: eventViews.sort(),
      name: routeName(route.file),
    });
  }
  if (problems.length > 0) {
    await rm(serverDir, { recursive: true, force: true });
    throw new BuildError(problems);
  }

  // Browser build: one entry per route. A route that ships JavaScript
  // gets the hydration entry; the others get an entry that exists only
  // so Vite extracts their stylesheet, and its script is dropped.
  const entries = planned.map((p) => ({
    ...p,
    id: entryId(
      `/routes/${p.route.file}`,
      shipsJavaScript(p.shape.render, p.eventViews) ? 'hydrate' : 'css',
      {
        theme: true,
      },
    ),
  }));
  await viteBuild({
    ...shared,
    plugins: [scampPlugin(root)],
    build: {
      outDir,
      emptyOutDir: true,
      manifest: true,
      rollupOptions: {
        input: Object.fromEntries(entries.map((e) => [e.name, e.id])),
      },
    },
  });
  const manifest = JSON.parse(
    await readFile(join(outDir, '.vite', 'manifest.json'), 'utf8'),
  ) as Manifest;
  const entryFor = (name: string): { key: string; chunk: ManifestChunk } => {
    const found = Object.entries(manifest).find(
      ([, m]) => m.isEntry === true && m.name === name,
    );
    if (found === undefined) {
      throw new Error(`the browser build produced no entry for ${name}.`);
    }
    return { key: found[0], chunk: found[1] };
  };
  const assets = entries.map((entry) => {
    const asset = entryFor(entry.name);
    const javascript = shipsJavaScript(entry.shape.render, entry.eventViews);
    const script = asset.chunk.file.endsWith('.css')
      ? null
      : `/${asset.chunk.file}`;
    return {
      ...entry,
      javascript,
      stylesheets: stylesheetsFor(manifest, asset.key).map((css) => `/${css}`),
      script: javascript ? script : null,
      scriptFile: script,
    };
  });

  // Prerender what can be prerendered.
  const env = readEnv(root);
  const built: BuiltRoute[] = [];
  for (const entry of assets) {
    const pages: string[] = [];
    if (!entry.perRequest) {
      const paramsList: Params[] =
        entry.shape.params !== null ? await entry.shape.params() : [{}];
      for (const params of paramsList) {
        const path = pagePath(entry.route.segments, params);
        const html = await renderPage({
          route: entry.shape,
          title: routeTitle(entry.route.file),
          params,
          request: new Request(`http://localhost${path}`),
          env,
          links: entry.stylesheets,
          entry: entry.script,
          javascript: entry.javascript,
        });
        const target = join(outDir, outputFile(path));
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, html, 'utf8');
        pages.push(path);
      }
    }
    if (!entry.javascript && entry.scriptFile !== null) {
      await rm(join(outDir, entry.scriptFile.slice(1)), { force: true });
    }
    built.push({
      file: entry.route.file,
      mode: entry.shape.render,
      pages,
      perRequest: entry.perRequest,
      javascript: entry.javascript,
      eventViews: entry.eventViews,
    });
  }

  // `public/` ships as is; the manifest is ours.
  if (existsSync(join(root, 'public'))) {
    await cp(join(root, 'public'), outDir, { recursive: true });
  }
  await rm(join(outDir, '.vite'), { recursive: true, force: true });

  // The server bundle: one ES module, everything inlined, for the adapter.
  if (adapter !== null) {
    const serverOut = join(serverDir, 'server');
    await viteBuild({
      ...shared,
      plugins: [
        scampPlugin(root),
        virtualPlugin(SERVER_ENTRY, serverEntryCode(assets, api)),
      ],
      build: {
        ssr: true,
        outDir: serverOut,
        emptyOutDir: true,
        rollupOptions: {
          input: { index: SERVER_ENTRY },
          output: {
            entryFileNames: 'index.js',
            format: 'es',
            inlineDynamicImports: true,
          },
        },
      },
      ssr: {
        target: adapter.serverTarget,
        noExternal: true,
        ...(adapter.serverTarget === 'webworker'
          ? { resolve: { conditions: ['workerd', 'worker', 'browser'] } }
          : {}),
      },
    });
    const adapterRoutes: AdapterRoute[] = built.map((r) => ({
      file: r.file,
      mode: r.mode,
      pages: r.pages,
      perRequest: r.perRequest,
    }));
    await adapter.build({
      root,
      outDir,
      serverEntry: join(serverOut, 'index.js'),
      routes: adapterRoutes,
      projectName: info.name,
      log: (line) => stderr.write(`${line}\n`),
    });
  }
  await rm(serverDir, { recursive: true, force: true });

  for (const r of built) {
    const pages = r.perRequest
      ? 'per request'
      : `${r.pages.length} page${r.pages.length === 1 ? '' : 's'}`;
    stderr.write(
      `${r.file}  ${r.mode}  ${pages}  ${r.javascript ? 'js' : 'no js'}\n`,
    );
  }
  for (const a of api) stderr.write(`${a.file}  api\n`);
  return { outDir, routes: built, adapter: adapter?.name ?? null };
};
