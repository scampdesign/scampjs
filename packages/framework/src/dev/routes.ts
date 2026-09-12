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
 * route: the wrong extension, or under `api/`, which is reserved for
 * contract 2 and has no shape yet.
 */
export const routeSegments = (file: string): Segment[] | null => {
  if (!ROUTE_EXTENSION.test(file)) return null;
  const parts = file.replace(ROUTE_EXTENSION, '').split('/');
  if (parts[0] === 'api') return null;
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

/** Every route under `routesDir`, sorted most specific first. Empty when the folder is missing. */
export const scanRoutes = (routesDir: string): RouteEntry[] => {
  let files: string[];
  try {
    files = walk(routesDir, routesDir);
  } catch {
    return [];
  }
  const routes: RouteEntry[] = [];
  for (const file of files) {
    const segments = routeSegments(file);
    if (segments !== null) routes.push({ file, segments });
  }
  return routes.sort(compareRoutes);
};

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
