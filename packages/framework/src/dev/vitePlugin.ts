/**
 * The Vite side of `scamp dev`: the `@/` alias, React names mapped to
 * Preact so views that say `React.ReactNode` run unchanged, JSX through
 * Preact's automatic runtime, and the virtual hydration entry a `client`
 * route's page loads. see docs/notes/dev-server.md
 */
import type { Plugin } from 'vite';

export const ENTRY_PREFIX = 'virtual:scamp-entry';

/** The module URL the shell puts in a `client` route's page. */
export const entryUrl = (routeUrl: string): string =>
  `/@id/${ENTRY_PREFIX}?route=${encodeURIComponent(routeUrl)}`;

const entryCode = (
  routeUrl: string,
): string => `import { h, hydrate } from 'preact';
import * as route from ${JSON.stringify(routeUrl)};
const payload = JSON.parse(document.getElementById('scamp-data').textContent);
globalThis[Symbol.for('scampjs.params')] = payload.params;
hydrate(h(route.default, { params: payload.params, data: payload.data }), document.getElementById('scamp-root'));
`;

export const scampPlugin = (root: string): Plugin => ({
  name: 'scamp',
  config: () => ({
    resolve: {
      alias: [
        { find: /^@\//, replacement: `${root}/` },
        { find: /^react$/, replacement: 'preact/compat' },
        { find: /^react-dom$/, replacement: 'preact/compat' },
        { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
      ],
    },
    oxc: {
      jsx: { runtime: 'automatic', importSource: 'preact' },
    },
  }),
  resolveId: (id): string | null => (id.startsWith(ENTRY_PREFIX) ? id : null),
  load: (id): string | null => {
    if (!id.startsWith(ENTRY_PREFIX)) return null;
    const route = new URLSearchParams(id.slice(ENTRY_PREFIX.length)).get(
      'route',
    );
    return route === null ? null : entryCode(route);
  },
});
