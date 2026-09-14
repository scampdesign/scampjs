# API routes

A file under `routes/api/` answers its path, with the same segment
syntax as a page and the `api` prefix kept:

| File                                | URL                       |
| ----------------------------------- | ------------------------- |
| `routes/api/health.ts`              | `/api/health`             |
| `routes/api/games/[token]/start.ts` | `/api/games/:token/start` |

## Plain handlers (the default)

One named export per method, over the same `LoadContext` as `load()`,
returning a standard `Response`. Nothing to import from Hono:

```ts
import type { ApiHandler } from 'scampjs/runtime';
import { startGame } from '@/lib/game';

export const POST: ApiHandler<{ token: string }> = async ({ params, env }) => {
  const game = await startGame(env.DB, params.token);
  return Response.json({ game });
};
```

`GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS` are
recognised. A method the file doesn't export gets `405` with an `Allow`
header; `HEAD` falls back to `GET`.

## A Hono app

Export a Hono app as the default for routing inside the file,
middleware (sessions, auth, CORS, validation), and Hono's typed client.
It is mounted at the file's path, so its routes are relative:

```ts
import { Hono } from 'hono';

export default new Hono()
  .get('/', (c) => c.json({ ok: true }))
  .get('/deep', (c) => c.text('deep'));
```

`/api/health` and `/api/health/deep` both reach it. When an exact file
and a mounted app both match, the exact file wins.

## Where they run

`scamp dev` serves them per request. `scamp build` needs an
[adapter](deploy-cloudflare.md) for them: a static folder cannot answer
a `POST`, and the build says so.
