# Deploy to Cloudflare

```bash
npm install @scampjs/adapter-cloudflare
```

In `package.json`:

```json
{ "scamp": { "adapter": "@scampjs/adapter-cloudflare" } }
```

```bash
npm run build
npx wrangler deploy
```

`scamp build` prerenders every page it can into `dist/`, bundles the
server into `dist/_worker.js`, and on the first build writes a
`wrangler.jsonc` that names `dist/` as the static assets directory and
the worker as `main`. The platform serves files first; the worker
answers `render = 'server'` routes, dynamic routes without `params()`,
and everything under `routes/api/`.

`env` in `load()` and API handlers is the Worker's bindings. Declare a
D1 database, KV, or secrets in `wrangler.jsonc`; with the `d1` Drizzle
dialect, `env.DB` is the database and `npx wrangler d1 migrations apply`
applies the migrations `npm run db:generate` wrote.

Pages: the same `dist/` folder with its `_worker.js` deploys as a Pages
project in advanced mode.
