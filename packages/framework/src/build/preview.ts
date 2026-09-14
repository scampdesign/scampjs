/**
 * `scamp preview`: serve `dist/` the way a static host would — a path
 * maps to `<path>/index.html`, assets are files, anything else is 404.
 * No rewrites, no fallbacks, so what works here works on any host.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** The file under `dir` a request path resolves to, or null. Never escapes `dir`. */
export const resolveStatic = (dir: string, pathname: string): string | null => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname.split('?')[0] ?? '/');
  } catch {
    return null;
  }
  const inside = normalize(join(dir, decoded));
  if (inside !== dir && !inside.startsWith(dir + sep)) return null;
  const candidates =
    decoded.endsWith('/') || extname(decoded) === ''
      ? [join(inside, 'index.html'), inside]
      : [inside];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

export type PreviewServer = {
  port: number;
  url: string;
  close: () => Promise<void>;
};

export const createPreviewServer = async (opts: {
  dir: string;
  port?: number;
}): Promise<PreviewServer> => {
  const dir = resolve(opts.dir);
  if (!existsSync(dir)) {
    throw new Error(`${dir} does not exist; run scamp build first.`);
  }
  const server: Server = createServer((req, res) => {
    const file =
      req.method === 'GET' || req.method === 'HEAD'
        ? resolveStatic(dir, req.url ?? '/')
        : null;
    if (file === null) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  });
  const port = await new Promise<number>((resolvePort, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('The server did not report a port.'));
        return;
      }
      resolvePort(address.port);
    });
  });
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((done) => {
        server.close(() => done());
        server.closeAllConnections();
      }),
  };
};
