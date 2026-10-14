# SVG attribute names

Scamp writes SVG attributes the React way — `strokeWidth`,
`strokeLinecap`, `fillRule`, `clipRule` — because its canvas renders with
React, and because that's what agents and React users write. React maps
them to `stroke-width` and the rest. Core Preact, which a view compiles
against (`jsxImportSource: 'preact'`), doesn't: it wrote
`<svg strokeWidth="2">`, the HTML parser lowercased that to
`strokewidth`, SVG ignored it, and every icon drew a 1px stroke while the
canvas drew 2px. Components that looked right only did because their CSS
set `stroke-width` too.

`preact/compat` does the mapping, in an `options.vnode` hook that runs as
each vnode is created. Before this it loaded only when something imported
`react` (the alias in `dev/vitePlugin.ts`), and views don't. Now it's
imported for its side effect in two places:

- `server/render.ts` — every server render, dev and built, goes through
  this module (`dev/render.ts` and `server/app.ts` import it; the
  Cloudflare adapter runs the built server).
- The `hydrate` entry in `dev/vitePlugin.ts`'s `entryCode` — the
  production build uses the same function. Without it the first client
  re-render would write the camelCase names back. The `css` entry ships
  no JavaScript and doesn't need it.

It adds a few KB to pages that hydrate. The contract states the rule
(section 1.2, item 5), and `fixtures/contract-0/views/Home` carries an
icon written this way.
