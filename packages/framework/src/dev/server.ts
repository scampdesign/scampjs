/**
 * `scamp dev`: one HTTP server on 127.0.0.1. Vite's middleware answers
 * module, asset, and HMR requests; everything else falls through to a
 * Hono app that serves `/_views/` and the file routes. Any change under
 * the project reloads open pages, because a rendered page's modules
 * live only in the SSR graph. see docs/notes/dev-server.md
 */
import { existsSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { join, relative, resolve, sep } from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { Hono } from 'hono';
import { createLogger, createServer as createViteServer } from 'vite';
import type { Logger, ViteDevServer } from 'vite';
import { readEnv } from './env.js';
import { createLog } from './log.js';
import type { Log } from './log.js';
import { renderRoute, renderView } from './render.js';
import { handleApiRequest } from '../server/api.js';
import { matchRoute, scanApiRoutes, scanRoutes } from './routes.js';
import type { RouteEntry } from './routes.js';
import { scampPlugin } from './vitePlugin.js';
import { listViews, VIEW_NAME } from './views.js';

export type DevServerOptions = {
  /** The project root: the folder holding `views/`, `routes/`, `design/`. */
  root: string;
  /** A port to bind, or 0 (the default) for a free one. */
  port?: number;
  json?: boolean;
  stdout?: { write: (chunk: string) => unknown };
  stderr?: { write: (chunk: string) => unknown };
};

export type DevServer = {
  port: number;
  url: string;
  close: () => Promise<void>;
};

const errorText = (err: unknown): { message: string; stack: string } =>
  err instanceof Error
    ? { message: err.message, stack: err.stack ?? '' }
    : { message: String(err), stack: '' };

/** Vite's own logging goes to stderr, so stdout carries only the readiness line. */
const stderrLogger = (write: (chunk: string) => unknown): Logger => {
  const base = createLogger('info', { allowClearScreen: false });
  const to =
    (level: 'info' | 'warn' | 'error') =>
    (msg: string): void => {
      write(`vite ${level}: ${msg}\n`);
    };
  return {
    ...base,
    info: to('info'),
    warn: to('warn'),
    warnOnce: to('warn'),
    error: to('error'),
  };
};

const listen = (server: Server, port: number): Promise<number> =>
  new Promise((resolvePort, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('The server did not report a port.'));
        return;
      }
      resolvePort(address.port);
    });
  });

const buildApp = (
  vite: ViteDevServer,
  root: string,
  routes: () => RouteEntry[],
  apiRoutes: () => RouteEntry[],
  log: Log,
): Hono => {
  const app = new Hono();
  app.get('/_views/', (c) => c.json({ views: listViews(root) }));
  app.get('/_views/:name', async (c) => {
    const name = c.req.param('name');
    if (!VIEW_NAME.test(name)) return c.text('Not found', 404);
    const page = await renderView(vite, root, name);
    return page === null ? c.text('Not found', 404) : c.html(page.html);
  });
  app.all('*', async (c) => {
    const path = c.req.path;
    if (path.startsWith('/_views')) return c.text('Not found', 404);
    if (path === '/api' || path.startsWith('/api/')) {
      const answer = await handleApiRequest(
        apiRoutes(),
        c.req.raw,
        readEnv(root),
        (file) => vite.ssrLoadModule(`/routes/${file}`),
      );
      return answer ?? c.text('Not found', 404);
    }
    const match = matchRoute(routes(), path);
    if (match === null) return c.text('Not found', 404);
    const page = await renderRoute({
      vite,
      root,
      file: match.route.file,
      params: match.params,
      request: c.req.raw,
      env: readEnv(root),
    });
    return c.html(page.html);
  });
  app.onError((err, c) => {
    vite.ssrFixStacktrace(err);
    const { message, stack } = errorText(err);
    log.error({ path: c.req.path, message, stack });
    return c.text(`${message}\n\n${stack}`, 500);
  });
  return app;
};

export const createDevServer = async (
  opts: DevServerOptions,
): Promise<DevServer> => {
  const root = resolve(opts.root);
  if (!existsSync(join(root, 'package.json'))) {
    throw new Error(
      `${root} has no package.json; run scamp dev from the project root.`,
    );
  }
  const stdout = opts.stdout ?? process.stdout;
  const stderr = opts.stderr ?? process.stderr;
  const log = createLog({ json: opts.json ?? false, stdout, stderr });

  const httpServer = createHttpServer();
  const vite = await createViteServer({
    root,
    configFile: false,
    envDir: false,
    appType: 'custom',
    clearScreen: false,
    customLogger: stderrLogger((chunk) => stderr.write(chunk)),
    plugins: [scampPlugin(root)],
    server: { middlewareMode: true, hmr: { server: httpServer } },
  });

  // Routes are rescanned when a file under routes/ appears or goes;
  // renders always see the current table.
  const routesDir = join(root, 'routes');
  let routes: RouteEntry[] | null = null;
  let apiRoutes: RouteEntry[] | null = null;
  const currentRoutes = (): RouteEntry[] => {
    routes ??= scanRoutes(routesDir);
    return routes;
  };
  const currentApiRoutes = (): RouteEntry[] => {
    apiRoutes ??= scanApiRoutes(routesDir);
    return apiRoutes;
  };
  const inside = (file: string): boolean => {
    const rel = relative(root, file);
    return (
      rel !== '' &&
      !rel.startsWith('..') &&
      !rel
        .split(sep)
        .some((part) => part === 'node_modules' || part.startsWith('.'))
    );
  };
  vite.watcher.on('all', (event, file) => {
    if (!inside(file)) return;
    if (
      (event === 'add' || event === 'unlink') &&
      !relative(routesDir, file).startsWith('..')
    ) {
      routes = null;
      apiRoutes = null;
    }
    vite.ws.send({ type: 'full-reload', path: '*' });
  });

  const hono = getRequestListener(
    buildApp(vite, root, currentRoutes, currentApiRoutes, log).fetch,
  );
  httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
    const started = performance.now();
    res.on('finish', () => {
      log.request({
        method: req.method ?? 'GET',
        path: req.url ?? '/',
        status: res.statusCode,
        ms: Math.round(performance.now() - started),
      });
    });
    vite.middlewares(req, res, () => {
      void hono(req, res);
    });
  });

  let port: number;
  try {
    port = await listen(httpServer, opts.port ?? 0);
  } catch (err) {
    await vite.close();
    throw err;
  }
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    close: async (): Promise<void> => {
      await vite.close();
      await new Promise<void>((done) => {
        httpServer.close(() => done());
        httpServer.closeAllConnections();
      });
    },
  };
};
