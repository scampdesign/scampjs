# The build

How `scamp build` turns a project into a folder, and the choices behind
it. CONTRACT.md section 2.3 is what it promises.

## Two Vite builds and a prerender

1. **Server build.** Every route file is an entry of one SSR build into
   `node_modules/.scamp/build-<pid>/`. The modules are then imported in
   the build process: `render`, `load`, and `params` are read from the
   real exports rather than parsed from source, and the component is
   rendered with `preact-render-to-string` exactly as the dev server
   renders it. A plugin on this build records, per route, which files
   under `views/` and `components/` ended up in its chunks (following
   shared chunks), and the `_scamp` export of each is read from source
   to learn its event props.
2. **Browser build.** One virtual entry per route, from the same plugin
   the dev server uses. A route that ships JavaScript gets the
   hydration entry: it imports `design/theme.css`, then only the
   route's default export, and hydrates `#scamp-root` from the page's
   JSON. A route that ships none gets a stylesheet entry that re-exports
   the route's default export so its module graph, and with it every
   view's CSS module, stays in the build; its script is deleted after.
   Vite extracts each entry's CSS to one hashed file, theme first.
3. **Prerender.** For each route, one page per `params()` entry (or
   one page), `load()` run with a `LoadContext` whose `request` is a
   `Request` for the page's URL and whose `env` is `process.env` plus
   `.dev.vars`, then `<path>/index.html` in the document shell with a
   `<link>` to the entry's stylesheet and, when the route ships
   JavaScript, the data block and the entry script. `public/` is copied
   over the result.

## Islands are per route

The plan promised islands from `_scamp.events`. The unit that hydrates
is the route: a view's event handlers are defined in the route file
that renders it, so a view cannot hydrate alone and still have anything
to call. What the metadata decides is whether a route ships JavaScript
at all. A static route whose views declare no events ships HTML and CSS
only; one that does hydrates the route with its data. Per-view islands
would need handlers to live in views or an event protocol, and neither
is in the contract.

## `load()` stays out of the browser

The hydration entry imports only the route's default export. Rolldown
tree-shakes `load()` and whatever only it imports, so a `load()` that
reads a database does not put the database client in the bundle. The
test `build.test.ts` proves a server-only marker never reaches
`dist/`. A module with top-level side effects is kept regardless; keep
server-only imports side-effect free, or behind a dynamic import inside
`load()`.

## What the static adapter refuses

`render = 'server'` needs a request per page and errors until an
adapter exists. A dynamic route with no `params()` cannot be
enumerated and errors too. Both name the fix, and the build writes
nothing when any route is refused, so a broken deploy cannot come from
a partial `dist/`.

## `scamp preview`

A plain Node server over `dist/`: a path resolves to `<path>/index.html`
or to a file, with no rewrites, so what it serves is what a static host
serves. It never resolves outside the folder.
