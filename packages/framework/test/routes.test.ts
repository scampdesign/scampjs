import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compareRoutes,
  matchRoute,
  routeSegments,
  scanRoutes,
  type RouteEntry,
} from '../src/dev/routes.js';

const entry = (file: string): RouteEntry => {
  const segments = routeSegments(file);
  if (segments === null) throw new Error(`${file} is not a route`);
  return { file, segments };
};

describe('routeSegments', () => {
  it('maps index.tsx to the folder path', () => {
    expect(routeSegments('index.tsx')).toEqual([]);
    expect(routeSegments('about/index.tsx')).toEqual([
      { kind: 'static', value: 'about' },
    ]);
  });

  it('maps a plain file to a static segment', () => {
    expect(routeSegments('about.tsx')).toEqual([
      { kind: 'static', value: 'about' },
    ]);
  });

  it('reads [param] and [...rest] segments', () => {
    expect(routeSegments('game/[token]/lobby.tsx')).toEqual([
      { kind: 'static', value: 'game' },
      { kind: 'param', name: 'token' },
      { kind: 'static', value: 'lobby' },
    ]);
    expect(routeSegments('docs/[...slug].tsx')).toEqual([
      { kind: 'static', value: 'docs' },
      { kind: 'rest', name: 'slug' },
    ]);
  });

  it('drops (group) folders from the path', () => {
    expect(routeSegments('(marketing)/pricing.tsx')).toEqual([
      { kind: 'static', value: 'pricing' },
    ]);
  });

  it('accepts .jsx, .ts, and .js and rejects anything else', () => {
    expect(routeSegments('a.jsx')).not.toBeNull();
    expect(routeSegments('a.ts')).not.toBeNull();
    expect(routeSegments('a.js')).not.toBeNull();
    expect(routeSegments('a.css')).toBeNull();
    expect(routeSegments('README.md')).toBeNull();
  });

  it('leaves routes/api/** to contract 2', () => {
    expect(routeSegments('api/games.ts')).toBeNull();
  });
});

describe('compareRoutes', () => {
  it('orders static before param before rest, position by position', () => {
    const sorted = [
      entry('[...rest].tsx'),
      entry('[slug].tsx'),
      entry('about.tsx'),
      entry('index.tsx'),
    ].sort(compareRoutes);
    expect(sorted.map((r) => r.file)).toEqual([
      'index.tsx',
      'about.tsx',
      '[slug].tsx',
      '[...rest].tsx',
    ]);
  });
});

describe('matchRoute', () => {
  const routes = [
    entry('index.tsx'),
    entry('about.tsx'),
    entry('game/[token]/lobby.tsx'),
    entry('game/[token]/index.tsx'),
    entry('docs/[...slug].tsx'),
    entry('[slug].tsx'),
  ].sort(compareRoutes);

  it('matches the root', () => {
    expect(matchRoute(routes, '/')?.route.file).toBe('index.tsx');
  });

  it('prefers a static segment over a param', () => {
    expect(matchRoute(routes, '/about')?.route.file).toBe('about.tsx');
    expect(matchRoute(routes, '/other')).toEqual({
      route: routes.find((r) => r.file === '[slug].tsx'),
      params: { slug: 'other' },
    });
  });

  it('captures params, decoded', () => {
    expect(matchRoute(routes, '/game/KZ%20Q4/lobby')).toEqual({
      route: routes.find((r) => r.file === 'game/[token]/lobby.tsx'),
      params: { token: 'KZ Q4' },
    });
    expect(matchRoute(routes, '/game/KZQ4')?.route.file).toBe(
      'game/[token]/index.tsx',
    );
  });

  it('joins a rest segment and requires at least one part', () => {
    expect(matchRoute(routes, '/docs/a/b/c')?.params).toEqual({
      slug: 'a/b/c',
    });
    // With the root [slug] route present, /docs is that route's job.
    expect(matchRoute(routes, '/docs')?.route.file).toBe('[slug].tsx');
    expect(matchRoute([entry('docs/[...slug].tsx')], '/docs')).toBeNull();
  });

  it('ignores a trailing slash', () => {
    expect(matchRoute(routes, '/about/')?.route.file).toBe('about.tsx');
  });

  it('returns null for an unmatched or undecodable path', () => {
    expect(matchRoute(routes, '/game/KZQ4/nope')).toBeNull();
    expect(matchRoute(routes, '/a/b/c')).toBeNull();
    expect(matchRoute(routes, '/%E0%A4%A')).toBeNull();
  });
});

describe('scanRoutes', () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir !== null) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it('walks the folder, skips non-routes and dotfiles, and sorts by specificity', () => {
    dir = mkdtempSync(join(tmpdir(), 'scamp-routes-'));
    mkdirSync(join(dir, 'game', '[token]'), { recursive: true });
    mkdirSync(join(dir, 'api'), { recursive: true });
    writeFileSync(join(dir, 'index.tsx'), '');
    writeFileSync(join(dir, '[slug].tsx'), '');
    writeFileSync(join(dir, 'game', '[token]', 'lobby.tsx'), '');
    writeFileSync(join(dir, 'game', '[token]', 'notes.md'), '');
    writeFileSync(join(dir, '.hidden.tsx'), '');
    writeFileSync(join(dir, 'api', 'games.ts'), '');
    expect(scanRoutes(dir).map((r) => r.file)).toEqual([
      'index.tsx',
      'game/[token]/lobby.tsx',
      '[slug].tsx',
    ]);
  });

  it('returns nothing when the folder is missing', () => {
    expect(scanRoutes(join(tmpdir(), 'scamp-does-not-exist'))).toEqual([]);
  });
});
