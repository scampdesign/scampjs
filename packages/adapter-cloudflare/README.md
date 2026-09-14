# @scampjs/adapter-cloudflare

Deploy a [Scamp framework](https://github.com/scampdesign/scampjs)
project to Cloudflare Workers with static assets, or to Pages.

```bash
npm install @scampjs/adapter-cloudflare
```

In `package.json`:

```json
{ "scamp": { "adapter": "@scampjs/adapter-cloudflare" } }
```

Then:

```bash
npm run build          # dist/ plus dist/_worker.js, and a wrangler.jsonc on the first build
npx wrangler deploy
```

Every prerendered page and asset is served by the platform's static
layer first; `_worker.js` answers server routes, dynamic routes, and
`routes/api/`. Bindings (a D1 database, KV, secrets) are declared in
`wrangler.jsonc` and arrive as `env` in `load()` and API handlers.
