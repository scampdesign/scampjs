import { describe, expect, it } from 'vitest';
import {
  decide,
  eventsDeclaredIn,
  outputFile,
  pagePath,
  shipsJavaScript,
} from '../src/build/plan.js';
import { routeSegments } from '../src/dev/routes.js';

const segs = (file: string): ReturnType<typeof routeSegments> =>
  routeSegments(file);

describe('decide', () => {
  it('prerenders static and client routes with no dynamic segments', () => {
    expect(
      decide({
        mode: 'static',
        dynamic: false,
        hasLoad: true,
        hasParams: false,
      }),
    ).toEqual({ kind: 'prerender', enumerate: false });
    expect(
      decide({
        mode: 'client',
        dynamic: false,
        hasLoad: false,
        hasParams: false,
      }),
    ).toEqual({ kind: 'prerender', enumerate: false });
  });

  it('enumerates a dynamic route through params()', () => {
    expect(
      decide({ mode: 'static', dynamic: true, hasLoad: true, hasParams: true }),
    ).toEqual({ kind: 'prerender', enumerate: true });
  });

  it('refuses a dynamic route without params(), naming the fix', () => {
    const d = decide({
      mode: 'static',
      dynamic: true,
      hasLoad: true,
      hasParams: false,
    });
    expect(d.kind).toBe('error');
    if (d.kind === 'error') expect(d.reason).toContain('params()');
  });

  it('refuses server rendering until an adapter exists', () => {
    const d = decide({
      mode: 'server',
      dynamic: false,
      hasLoad: false,
      hasParams: false,
    });
    expect(d.kind).toBe('error');
    if (d.kind === 'error') expect(d.reason).toContain('adapter');
  });
});

describe('pagePath and outputFile', () => {
  it('fills params into the segments and encodes them', () => {
    expect(
      pagePath(segs('game/[token]/lobby.tsx') ?? [], { token: 'KZ Q4' }),
    ).toBe('/game/KZ%20Q4/lobby');
    expect(pagePath(segs('docs/[...slug].tsx') ?? [], { slug: 'a/b' })).toBe(
      '/docs/a/b',
    );
    expect(pagePath(segs('index.tsx') ?? [], {})).toBe('/');
  });

  it('throws when params() forgets a segment', () => {
    expect(() => pagePath(segs('game/[token].tsx') ?? [], {})).toThrow(
      '"token"',
    );
  });

  it('maps a path to <path>/index.html', () => {
    expect(outputFile('/')).toBe('index.html');
    expect(outputFile('/about')).toBe('about/index.html');
    expect(outputFile('/game/KZ%20Q4/lobby')).toBe(
      'game/KZ Q4/lobby/index.html',
    );
  });
});

describe('shipsJavaScript', () => {
  it('is true for client routes and for routes whose views declare events', () => {
    expect(shipsJavaScript('static', [])).toBe(false);
    expect(shipsJavaScript('static', ['views/Lobby/Lobby.tsx'])).toBe(true);
    expect(shipsJavaScript('client', [])).toBe(true);
  });
});

describe('eventsDeclaredIn', () => {
  it('reads the _scamp export in its canonical form', () => {
    expect(
      eventsDeclaredIn(
        "export const _scamp = { contract: 1, events: ['onCopy', 'onStart'] } as const;\n",
      ),
    ).toEqual(['onCopy', 'onStart']);
    expect(
      eventsDeclaredIn(
        'export const _scamp = { contract: 0, events: [] } as const;',
      ),
    ).toEqual([]);
  });

  it('is null for a file without the export', () => {
    expect(
      eventsDeclaredIn('export default function X() { return null; }'),
    ).toBeNull();
  });
});
