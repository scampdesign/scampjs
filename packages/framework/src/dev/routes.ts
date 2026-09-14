/**
 * File-based routing over `routes/`: a file's path becomes a URL
 * pattern, and a request path is matched against the patterns from
 * most to least specific. Pure; the dev server owns the scanning
 * cache. Segment syntax is CONTRACT.md section 1.5.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export type Segment =
  | { kind: 'static'; value: string }
  | { kind: 'param'; name: string }
  | { kind: 'rest'; name: string };

export type RouteEntry = {
  /** POSIX path relative to `routes/`, e.g. `game/[token]/lobby.tsx`. */
  file: string;
  segments: Segment[];
};

export type RouteMatch = {
  route: RouteEntry;
  params: Record<string, string>;
};

const ROUTE_EXTENSION = /\.(tsx|jsx|ts|js)$/;

/**
 * The URL segments of one route file, or `null` when the file is not a
 * page route: the wrong extension, or under `api/`, which holds API
 * handlers (see `apiRouteSegments`).
 */
export const routeSegments = (file: string): Segment[] | null => {
  if (!ROUTE_EXTENSION.test(file)) return null;
  const parts = file.replace(ROUTE_EXTENSION, '').split('/');
  if (parts[0] === 'api') return null;
  return segmentsOf(parts);
};

/**
 * The URL segments of one API route file under `routes/api/`, keeping
 * the `api` prefix: `api/games/[token]/start.ts` → `/api/games/:token/start`.
 * Null for anything not under `api/`.
 */
export const apiRouteSegments = (file: string): Segment[] | null => {
  if (!ROUTE_EXTENSION.test(file)) return null;
  const parts = file.replace(ROUTE_EXTENSION, '').split('/');
  if (parts[0] !== 'api' || parts.length < 2) return null;
  return segmentsOf(parts);
};

const segmentsOf = (parts: string[]): Segment[] => {
  const segments: Segment[] = [];
  for (const [i, part] of parts.entries()) {
    if (part.startsWith('(') && part.endsWith(')')) continue;
    if (i === parts.length - 1 && part === 'index') continue;
    const rest = /^\[\.\.\.([^\]]+)\]$/.exec(part);
    if (rest?.[1] !== undefined) {
      segments.push({ kind: 'rest', name: rest[1] });
      continue;
    }
    const param = /^\[([^\]]+)\]$/.exec(part);
    if (param?.[1] !== undefined) {
      segments.push({ kind: 'param', name: param[1] });
      continue;
    }
    segments.push({ kind: 'static', value: part });
  }
  return segments;
};

const RANK: Record<Segment['kind'], number> = { static: 0, param: 1, rest: 2 };

/** Most specific first: static before param before rest, position by position. */
export const compareRoutes = (a: RouteEntry, b: RouteEntry): number => {
  const n = Math.min(a.segments.length, b.segments.length);
  for (let i = 0; i < n; i += 1) {
    const sa = a.segments[i];
    const sb = b.segments[i];
    if (sa === undefined || sb === undefined) break;
    const d = RANK[sa.kind] - RANK[sb.kind];
    if (d !== 0) return d;
  }
  if (a.segments.length !== b.segments.length) {
    return a.segments.length - b.segments.length;
  }
  return a.file.localeCompare(b.file);
};

const walk = (dir: string, base: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
};

const scanWith = (
  routesDir: string,
  toSegments: (file: string) => Segment[] | null,
): RouteEntry[] => {
  let files: string[];
  try {
    files = walk(routesDir, routesDir);
  } catch {
    return [];
  }
  const routes: RouteEntry[] = [];
  for (const file of files) {
    const segments = toSegments(file);
    if (segments !== null) routes.push({ file, segments });
  }
  return routes.sort(compareRoutes);
};

/** Every page route under `routesDir`, sorted most specific first. Empty when the folder is missing. */
export const scanRoutes = (routesDir: string): RouteEntry[] =>
  scanWith(routesDir, routeSegments);

/** Every API route under `routesDir/api`, sorted most specific first. */
export const scanApiRoutes = (routesDir: string): RouteEntry[] =>
  scanWith(routesDir, apiRouteSegments);

const pathParts = (pathname: string): string[] | null => {
  const trimmed = pathname.replace(/\/+$/, '');
  if (trimmed === '') return [];
  try {
    return trimmed
      .split('/')
      .slice(1)
      .map((p) => decodeURIComponent(p));
  } catch {
    return null;
  }
};

const matchOne = (
  route: RouteEntry,
  parts: string[],
): Record<string, string> | null => {
  const params: Record<string, string> = {};
  let i = 0;
  for (const seg of route.segments) {
    if (seg.kind === 'rest') {
      const remaining = parts.slice(i);
      if (remaining.length === 0) return null;
      params[seg.name] = remaining.join('/');
      return params;
    }
    const part = parts[i];
    if (part === undefined || part === '') return null;
    if (seg.kind === 'static') {
      if (seg.value !== part) return null;
    } else {
      params[seg.name] = part;
    }
    i += 1;
  }
  return i === parts.length ? params : null;
};

/**
 * Every route whose pattern is a prefix of `pathname`, most specific and
 * longest first, with how many path parts each consumed. An API file
 * that exports a Hono app answers its own sub-paths, so the dispatcher
 * needs the prefix matches, not only the exact one.
 */
export const matchRoutePrefixes = (
  routes: ReadonlyArray<RouteEntry>,
  pathname: string,
): Array<RouteMatch & { consumed: number; exact: boolean }> => {
  const parts = pathParts(pathname);
  if (parts === null) return [];
  const out: Array<RouteMatch & { consumed: number; exact: boolean }> = [];
  for (const route of routes) {
    const params: Record<string, string> = {};
    let i = 0;
    let ok = true;
    for (const seg of route.segments) {
      if (seg.kind === 'rest') {
        const remaining = parts.slice(i);
        if (remaining.length === 0) {
          ok = false;
          break;
        }
        params[seg.name] = remaining.join('/');
        i = parts.length;
        break;
      }
      const part = parts[i];
      if (part === undefined || part === '') {
        ok = false;
        break;
      }
      if (seg.kind === 'static' ? seg.value !== part : false) {
        ok = false;
        break;
      }
      if (seg.kind === 'param') params[seg.name] = part;
      i += 1;
    }
    if (ok) out.push({ route, params, consumed: i, exact: i === parts.length });
  }
  return out.sort(
    (a, b) => Number(b.exact) - Number(a.exact) || b.consumed - a.consumed,
  );
};

/** The first route (in specificity order) that matches `pathname`, or null. */
export const matchRoute = (
  routes: ReadonlyArray<RouteEntry>,
  pathname: string,
): RouteMatch | null => {
  const parts = pathParts(pathname);
  if (parts === null) return null;
  for (const route of routes) {
    const params = matchOne(route, parts);
    if (params !== null) return { route, params };
  }
  return null;
};
