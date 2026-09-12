# The dev server

How `scamp dev` is put together, and the choices that are not obvious
from the code. CONTRACT.md section 2 is what it promises; this is how.

## One port, two handlers

`createDevServer` opens one Node `http.Server` on 127.0.0.1 and hands
every request to Vite's middleware first. Vite is in middleware mode
with `appType: 'custom'`, so it answers module, asset, and HMR requests
(the HMR websocket shares the port through `server.hmr.server`) and
calls `next()` for anything else. `next()` is a Hono app converted with
`@hono/node-server`'s `getRequestListener`: `/_views/`,
`/_views/<Name>`, and a catch-all that matches the file routes.

Route files never see Hono. The catch-all builds a `LoadContext` from
`c.req.raw` (a standard `Request`), the matched params, and `readEnv`,
and hands it to `renderRoute`.

## Rendering

A route or view is loaded with `vite.ssrLoadModule`, so Vite transforms
TSX, resolves the `@/` alias, and hands CSS modules back as their
class-name maps. `preact-render-to-string` renders it. `preact` is
externalised by Vite's SSR and imported by this package as a peer, so
both sides share one Preact instance, which the hooks need.

`useParams()` reads a symbol-keyed global rather than a context: the
renderer, the route module in Vite's runner, and the browser entry are
three different instances of `scampjs/runtime`, and `Symbol.for` is the
one thing all three see. Rendering is synchronous, so `withParams`
sets it around the render and clears it after.

## Styles are inlined

A page rendered on the server has its modules only in the SSR module
graph; nothing in the browser imports them, so Vite's client would
never inject their styles. `collectCss` walks `ssrImportedModules` from
the entry file, asks Vite for each `.css` module with `?direct` (which
returns compiled CSS text, hashed class names included for modules),
and inlines them as `<style>` blocks after `design/theme.css`, which is
read from disk. The parity harness in the app gets one self-contained
document.

Because of that, CSS HMR cannot patch a rendered page. The watcher
sends `full-reload` on any change under the project (not `node_modules`
or dotfolders), and the page reloads with fresh markup and styles.
Simple and always right; islands and finer HMR are for `scamp build`
and later.

## Hydration

Only `render = 'client'` routes get JavaScript: the shell embeds
`{ params, data }` as JSON and loads the virtual module
`virtual:scamp-entry?route=/routes/…`, which the Vite plugin serves.
The entry imports the route module in the browser, sets the params
global, and hydrates into `#scamp-root`. A `static` or `server` route
ships only Vite's client for reload. The route module, `load()` and
all, is loaded in the browser for a `client` route; a `load()` that
imports server-only code will fail there. `scamp build` (phase 4)
strips `load()` from the client bundle; until then, keep server-only
imports inside `load()` via dynamic import.

## Logging and the readiness line

Vite's logger is replaced with one that writes to stderr, and human
request logs go to stderr too, so stdout carries the readiness line
first and, with `--json`, one object per request or error after it.
The request log wraps the HTTP server's `finish` event, so requests
Vite answers are logged as well as Hono's.

## Tests

`test/dev-server.test.ts` starts the server in-process on the
contract-0 fixture and on a project scaffolded from the templates into
`test/.tmp/` (inside the repo so `preact` resolves through the
workspace). `test/cli.test.ts` spawns the built binary; the root
`pretest` script builds first.
