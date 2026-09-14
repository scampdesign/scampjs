# `load()`

`load()` runs on the server, or at build time, and never in the
browser. It receives a `LoadContext` and returns the route's data,
which the component gets as `data`:

```ts
type LoadContext<P extends Params = Params> = {
  params: P;        // the matched route params
  request: Request; // the standard Request for the page
  env: Env;         // bindings and secrets
};
```

`env` is what the adapter provides. The dev server and the build fill
it from `process.env` overlaid with `.dev.vars` (one `KEY=value` per
line). Type it once in `scamp-env.d.ts`:

```ts
declare module 'scampjs/runtime' {
  interface Env {
    DATABASE_URL: string;
  }
}
```

Compute in logic, bind in the view: formatting, arithmetic, and mapping
a database row to a view's props belong in the route file. Views take
strings, booleans, lists, and handlers.

A hydrated page imports only the route's component, so `load()` and the
modules it alone imports are tree-shaken out of the browser bundle. A
module with top-level side effects is kept; keep server-only imports
side-effect free, or import them inside `load()`.
