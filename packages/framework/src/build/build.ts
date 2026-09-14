/**
 * `scamp build`: prerender every route into `dist/`, a folder any static
 * host serves. Two Vite builds — one for the server, to run `load()` and
 * render at build time, and one for the browser, for the stylesheet each
 * page links and the hydration entry a page that ships JavaScript
 * loads — then one HTML file per page. see docs/notes/build.md
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { h } from 'preact';
import type { ComponentType } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { build as viteBuild } from 'vite';
import type { Plugin } from 'vite';
import { readEnv } from '../dev/env.js';
import { scanRoutes } from '../dev/routes.js';
import type { RouteEntry } from '../dev/routes.js';
import { documentShell } from '../dev/shell.js';
import { entryId, scampPlugin } from '../dev/vitePlugin.js';
import type { Env, LoadContext, Params, RenderMode } from '../runtime/index.js';
import { withParams } from '../runtime/params.js';
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
  pages: string[];
  javascript: boolean;
  /** Views and components under the route that declare event props. */
  eventViews: string[];
};

export type BuildResult = { outDir: string; routes: BuiltRoute[] };

export class BuildError extends Error {
  readonly problems: ReadonlyArray<{ file: string; reason: string }>;
  constructor(problems: ReadonlyArray<{ file: string; reason: string }>) {
    super(problems.map((p) => `routes/${p.file}: ${p.reason}`).join('\n'));
    this.name = 'BuildError';
    this.problems = problems;
  }
}

type RouteModule = {
  default: ComponentType<{ params: Params; data: unknown }>;
  load?: (ctx: LoadContext) => unknown;
  params?: () => Params[] | Promise<Params[]>;
  render?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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

const loadRouteModule = async (file: string): Promise<RouteModule> => {
  const mod: unknown = await import(pathToFileURL(file).href);
  if (!isRecord(mod) || typeof mod['default'] !== 'function') {
    throw new Error('has no default export; a route file exports a component.');
  }
  const render = mod['render'];
  if (
    render !== undefined &&
    render !== 'static' &&
    render !== 'server' &&
    render !== 'client'
  ) {
    throw new Error("render must be 'static', 'server', or 'client'.");
  }
  return mod as RouteModule;
};

const modeOf = (mod: RouteModule): RenderMode =>
  mod.render === 'server' || mod.render === 'client' ? mod.render : 'static';

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
  const routes = scanRoutes(join(root, 'routes'));
  if (routes.length === 0) {
    throw new Error('routes/ has no route files; nothing to build.');
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
      outDir: serverDir,
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
  const planned: {
    route: RouteEntry;
    mod: RouteModule;
    mode: RenderMode;
    eventViews: string[];
  }[] = [];
  for (const route of routes) {
    let mod: RouteModule;
    try {
      mod = await loadRouteModule(
        join(serverDir, `${routeName(route.file)}.js`),
      );
    } catch (err) {
      problems.push({
        file: route.file,
        reason: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    const mode = modeOf(mod);
    const decision = decide({
      mode,
      dynamic: route.segments.some((s) => s.kind !== 'static'),
      hasLoad: typeof mod.load === 'function',
      hasParams: typeof mod.params === 'function',
    });
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
    planned.push({ route, mod, mode, eventViews: eventViews.sort() });
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
    name: routeName(p.route.file),
    id: entryId(
      `/routes/${p.route.file}`,
      shipsJavaScript(p.mode, p.eventViews) ? 'hydrate' : 'css',
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

  // Prerender.
  const env = readEnv(root);
  const built: BuiltRoute[] = [];
  for (const entry of entries) {
    const javascript = shipsJavaScript(entry.mode, entry.eventViews);
    const asset = entryFor(entry.name);
    const stylesheets = stylesheetsFor(manifest, asset.key);
    const script = asset.chunk.file.endsWith('.css') ? null : asset.chunk.file;
    const paramsList: Params[] =
      typeof entry.mod.params === 'function' ? await entry.mod.params() : [{}];
    const pages: string[] = [];
    for (const params of paramsList) {
      const path = pagePath(entry.route.segments, params);
      const ctx: LoadContext = {
        params,
        request: new Request(`http://localhost${path}`),
        env: env as unknown as Env,
      };
      const data: unknown =
        typeof entry.mod.load === 'function'
          ? await entry.mod.load(ctx)
          : undefined;
      const body = withParams(params, () =>
        renderToString(h(entry.mod.default, { params, data })),
      );
      const html = documentShell({
        title: entry.route.file.replace(/\.(tsx|jsx|ts|js)$/, ''),
        styles: [],
        links: stylesheets.map((css) => `/${css}`),
        body,
        scripts: javascript && script !== null ? [`/${script}`] : [],
        data: javascript ? JSON.stringify({ params, data }) : undefined,
      });
      const target = join(outDir, outputFile(path));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, html, 'utf8');
      pages.push(path);
    }
    if (!javascript && script !== null)
      await rm(join(outDir, script), { force: true });
    built.push({
      file: entry.route.file,
      mode: entry.mode,
      pages,
      javascript,
      eventViews: entry.eventViews,
    });
  }

  // `public/` ships as is; the manifest and the server build are ours.
  if (existsSync(join(root, 'public'))) {
    await cp(join(root, 'public'), outDir, { recursive: true });
  }
  await rm(join(outDir, '.vite'), { recursive: true, force: true });
  await rm(serverDir, { recursive: true, force: true });

  for (const r of built) {
    stderr.write(
      `${r.file}  ${r.mode}  ${r.pages.length} page${r.pages.length === 1 ? '' : 's'}  ${r.javascript ? 'js' : 'no js'}\n`,
    );
  }
  return { outDir, routes: built };
};
