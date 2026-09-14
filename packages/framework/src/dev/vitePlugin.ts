/**
 * The Vite side of `scamp dev`: the `@/` alias, React names mapped to
 * Preact so views that say `React.ReactNode` run unchanged, JSX through
 * Preact's automatic runtime, and the virtual hydration entry a `client`
 * route's page loads. see docs/notes/dev-server.md
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export const ENTRY_PREFIX = 'virtual:scamp-entry';

export type EntryMode = 'hydrate' | 'css';

/**
 * The virtual module id for a route's browser entry. In dev the shell
 * loads it through `/@id/`; the build hands it to Vite as an input.
 * `hydrate` renders the route in the browser from the page's data;
 * `css` exists only so the build extracts the route's stylesheet.
 */
export const entryId = (
  routeUrl: string,
  mode: EntryMode = 'hydrate',
  opts: { theme?: boolean } = {},
): string =>
  `${ENTRY_PREFIX}?route=${encodeURIComponent(routeUrl)}&mode=${mode}${opts.theme === true ? '&theme=1' : ''}`;

/** The module URL the dev shell puts in a `client` route's page. */
export const entryUrl = (routeUrl: string): string =>
  `/@id/${entryId(routeUrl)}`;

// Only the default export is imported, so a production build drops
// `load()` and whatever it alone imports from the browser bundle.
const entryCode = (
  routeUrl: string,
  mode: EntryMode,
  theme: boolean,
): string => {
  const head = theme ? "import '/design/theme.css';\n" : '';
  // Re-exporting keeps the route's module graph, and with it the view
  // stylesheets, in the build; the emitted script is never linked.
  if (mode === 'css') {
    return `${head}import Route from ${JSON.stringify(routeUrl)};\nexport default Route;\n`;
  }
  return `${head}import { h, hydrate } from 'preact';
import Route from ${JSON.stringify(routeUrl)};
const payload = JSON.parse(document.getElementById('scamp-data').textContent);
globalThis[Symbol.for('scampjs.params')] = payload.params;
hydrate(h(Route, { params: payload.params, data: payload.data }), document.getElementById('scamp-root'));
`;
};

export const scampPlugin = (root: string): Plugin => ({
  name: 'scamp',
  enforce: 'pre',
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
    const query = new URLSearchParams(id.slice(ENTRY_PREFIX.length));
    const route = query.get('route');
    if (route === null) return null;
    const mode: EntryMode = query.get('mode') === 'css' ? 'css' : 'hydrate';
    // The dev shell inlines the theme itself; a built page links the
    // stylesheet its entry imports, so the build asks for it.
    const theme =
      query.get('theme') === '1' &&
      existsSync(join(root, 'design', 'theme.css'));
    return entryCode(route, mode, theme);
  },
});
