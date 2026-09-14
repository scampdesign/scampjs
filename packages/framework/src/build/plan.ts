/**
 * What `scamp build` does with each route, decided from its exports
 * alone. Pure, so the rules in CONTRACT.md section 2.3 are unit-tested
 * without a bundler. see docs/notes/build.md
 */
import type { RenderMode } from '../runtime/index.js';
import type { Segment } from '../dev/routes.js';

export type RouteFacts = {
  mode: RenderMode;
  /** Has a `[param]` or `[...rest]` segment. */
  dynamic: boolean;
  hasLoad: boolean;
  hasParams: boolean;
};

export type RouteDecision =
  { kind: 'prerender'; enumerate: boolean } | { kind: 'error'; reason: string };

/**
 * The static adapter prerenders; it cannot answer per request. A route
 * that needs a request — `server`, or a dynamic route with no `params()`
 * to enumerate — is an error that names the fix.
 */
export const decide = (facts: RouteFacts): RouteDecision => {
  if (facts.mode === 'server') {
    return {
      kind: 'error',
      reason:
        "render = 'server' needs a server adapter, which arrives with a later scampjs release. Use 'static' (with params() for dynamic segments) or 'client'.",
    };
  }
  if (facts.dynamic && !facts.hasParams) {
    return {
      kind: 'error',
      reason:
        'a dynamic route prerenders one page per entry of an exported params(); add params(), or wait for a server adapter.',
    };
  }
  return { kind: 'prerender', enumerate: facts.hasParams };
};

/** `/game/KZQ4/lobby` from the segments and one params object. */
export const pagePath = (
  segments: ReadonlyArray<Segment>,
  params: Readonly<Record<string, string>>,
): string => {
  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.kind === 'static') {
      parts.push(seg.value);
      continue;
    }
    const value = params[seg.name];
    if (value === undefined || value === '') {
      throw new Error(`params() entry is missing "${seg.name}".`);
    }
    parts.push(...(seg.kind === 'rest' ? value.split('/') : [value]));
  }
  return `/${parts.map(encodeURIComponent).join('/')}`;
};

/** `game/KZQ4/lobby/index.html` for `/game/KZQ4/lobby`; `index.html` for `/`. */
export const outputFile = (pathname: string): string => {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  const decoded = trimmed === '' ? '' : `${decodeURIComponent(trimmed)}/`;
  return `${decoded}index.html`;
};

/**
 * A route ships JavaScript when it renders in the browser, or when a
 * view it renders declares event props: those handlers live in the
 * route file, so the route as a whole is the island. A static route
 * whose views declare none ships HTML and CSS only.
 */
export const shipsJavaScript = (
  mode: RenderMode,
  eventViews: ReadonlyArray<string>,
): boolean => mode === 'client' || eventViews.length > 0;

const META_RE =
  /export\s+const\s+_scamp\s*=\s*\{\s*contract\s*:\s*(\d+)\s*,\s*events\s*:\s*\[([^\]]*)\]\s*\}\s*as\s+const\s*;/;

/** The `_scamp.events` a view or component file declares, or null without the export. */
export const eventsDeclaredIn = (source: string): string[] | null => {
  const match = META_RE.exec(source);
  if (!match) return null;
  return (match[2] ?? '')
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter((s) => s.length > 0);
};
