# Database

The framework bundles no ORM and no driver. One path is made easy, and
that path is [Drizzle](https://orm.drizzle.team):

```bash
npm create scampjs my-app -- --db sqlite    # or postgres, d1
# or, in an existing project
npx scamp add drizzle --dialect sqlite
```

Either writes:

| File                | Contents                                                                |
| ------------------- | ----------------------------------------------------------------------- |
| `db/schema.ts`      | The tables, as code; starts with one example                            |
| `lib/db.ts`         | `db(env)`: the client for one request, built from `env`                 |
| `drizzle.config.ts` | Dialect and paths for drizzle-kit; reads `.dev.vars`                    |
| `.dev.vars`         | `DATABASE_URL` for local development (gitignored)                       |
| `package.json`      | `db:generate`, `db:migrate`, `db:studio`                                |
| `scamp-env.d.ts`    | The `Env` fields, so `env.DATABASE_URL` (and `env.DB` for D1) are typed |
| `agent.md`          | A **Database** section an agent reads                                   |

Then `npm install`, `npm run db:generate`, `npm run db:migrate`.

## Read in `load()`, write in an API route

```ts
import type { LoadContext } from 'scampjs/runtime';
import { db } from '@/lib/db';
import { items } from '@/db/schema';

export async function load({ env }: LoadContext) {
  const rows = await db(env).select().from(items);
  return { items: rows.map((r) => ({ id: String(r.id), label: r.title })) };
}
```

The view's props are not the schema: the mapping from rows to props
belongs in the route file, so a redesign never touches a migration.

## Dialects

- **sqlite**: a libSQL file (`dev.db`) locally; a hosted libSQL URL in
  `DATABASE_URL` to deploy.
- **postgres**: `DATABASE_URL` locally and on the host.
- **d1**: `env.DB` on Cloudflare, declared in `wrangler.jsonc`; with no
  binding present, `db(env)` opens the same SQLite file locally, so
  `scamp dev` and the build run with no code change.
