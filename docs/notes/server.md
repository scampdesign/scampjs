# The server

What runs when a page cannot be a file: `scampjs/server`, the adapter
contract, and how the dev server shares them. CONTRACT.md sections 1.5
(API handlers), 2.3, and 2.6 are what they promise.

## One request handler, two hosts

`src/server/` holds the request handling both the dev server and the
built server use:

- `render.ts`: `routeModuleShape` reads a route module's exports and
  refuses the shapes the contract rules out; `renderPage` runs
  `load()`, renders the component with `useParams()` in scope, and
  wraps the markup in the document shell. The dev server passes inlined
  styles and Vite's client; the build passes stylesheet links and the
  hydration entry from the manifest.
- `api.ts`: `dispatchApi` runs the handler a request's method names
  (405 with `Allow` otherwise, `HEAD` from `GET`) or mounts a
  default-exported Hono app at the file's path; `handleApiRequest`
  picks the file: the exact match first, then, for a Hono app, the
  longest file whose path is a prefix of the request's, so an app
  answers its own sub-paths.
- `app.ts`: `createServerApp` is the built server: a Hono app over the
  route table `scamp build` writes into the server entry, with every
  route and API module imported statically. `env` is whatever the host
  hands `fetch()`; on Cloudflare that is the bindings object.

The dev server keeps loading modules through Vite and inlining styles;
it calls the same `renderPage` and `handleApiRequest`.

## The adapter contract

`package.json` names the adapter under `scamp.adapter`. When it does,
`scamp build` still prerenders every route it can, then bundles the
server entry into one ES module (`ssr.noExternal: true`, built for the
adapter's `serverTarget`, `webworker` or `node`) and calls
`adapter.build()` with the static folder, the bundle, the route table,
and the project name. The adapter lays them out for its host and
writes whatever config the host needs. `decide()` lets `server` routes
and un-enumerated dynamic routes through when an adapter is present;
they render per request from the bundle.

Prerendered pages stay in the bundle's route table too, so a host that
asks the server for one gets the same page.
