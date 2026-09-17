# Getting started

Create a project, run it, build it, deploy it.

## Create a project

```bash
npm create scampjs my-app
cd my-app
npm install
npm run dev
```

The scaffolder asks for a name and a database. Answer `none` to skip
the database; `sqlite`, `postgres`, and `d1` add
[Drizzle](../reference/database.md). Every question has a flag, so
`npm create scampjs my-app -- --db sqlite --yes` runs unattended.

`npm run dev` prints one line when it is ready, and nothing before it:

```
scamp dev ready http://127.0.0.1:41337
```

## What you get

```
my-app/
├── views/Home/Home.tsx          a page's structure
├── views/Home/Home.module.css   its styles
├── routes/index.tsx             the logic that puts it at /
├── design/theme.css             tokens, injected into every page
├── scamp-env.d.ts               the type of env
├── agent.md                     what a coding agent needs to know
├── package.json
└── tsconfig.json
```

A page is three files with one owner each. The view is its structure
and its styles. The route is its logic: what data it needs and where it
lives. Nothing else is required, and there is no `app/`, no
`layout.tsx`, and no config file beyond `package.json`.

## The view

A view is a plain function. Every prop is optional, and each default is
the sample the view renders with when nothing passes it anything:

```tsx
import styles from './Home.module.css';

type HomeProps = {
  title?: string;
  className?: string;
};

export default function Home({ title = "Noise With Friends", className }: HomeProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>
      <h1 data-scamp-id="title_a1b1" className={styles.title_a1b1}>{title}</h1>
    </div>
  );
}

export const _scamp = { contract: 2, events: [] } as const;
```

Three things to know about it:

- **It imports nothing from `scampjs`.** A view is JSX and a CSS
  module, so it drops into a Next, Remix, or Vite project unchanged.
  That portability is the point of keeping it this plain.
- **The defaults are the sample data.** `npm run dev` serves every view
  on its own at `/_views/Home` with its defaults, which is how you look
  at a design without wiring data to it first.
- **The last line is the framework's.** `_scamp` records the file
  format version and names the view's event props, which is how the
  build knows whether a page needs JavaScript at all. Copy it as it is
  and don't invent fields.

`data-scamp-id` is how the [Scamp app](with-the-scamp-app.md) finds
elements. Keep the attributes if you use the app; they cost nothing if
you don't.

## The route

A route file's path is its URL. `routes/index.tsx` answers `/`, and
`routes/game/[token]/lobby.tsx` answers `/game/:token/lobby`. See
[Routing](../reference/routing.md) for the full segment syntax.

```tsx
import type { LoadContext, RouteProps } from 'scampjs/runtime';
import Home from '@/views/Home/Home';

export const render = 'static';

export async function load({ env }: LoadContext) {
  return { title: env.SITE_NAME ?? 'Noise With Friends' };
}

export default function HomeRoute({ data }: RouteProps<typeof load>) {
  return <Home title={data.title} />;
}
```

`load()` runs on the server or at build time, never in the browser. It
receives the matched params, the standard `Request`, and `env`, and
what it returns becomes the component's `data`. See
[`load()`](../reference/load.md).

**Compute in logic, bind in the view.** Formatting, arithmetic, and
turning a database row into a view's props all belong in the route
file. A view takes strings, booleans, lists, and handlers. That split
is what lets a redesign leave the data alone, and a schema change leave
the design alone.

## Add a page

Two files and a route:

```bash
mkdir -p views/About
```

Write `views/About/About.tsx` and `About.module.css` in the shape
above, then `routes/about.tsx` rendering `<About />`. The dev server
picks all three up as you save them.

If you use the Scamp app, **+ Add Page** does this for you and
**Generate route** writes the route with the view's sample data already
in `load()`.

## Choose what ships

One export per route decides how it renders:

```ts
export const render = 'static';  // prerendered; the default
export const render = 'server';  // per request, through an adapter
export const render = 'client';  // prerendered, then runs in the browser
```

A route ships JavaScript only when it is `client`, or when a view it
renders declares event props. A marketing page built this way ships
HTML and one stylesheet, without anyone deciding that it should. See
[Rendering modes](../reference/rendering-modes.md).

## Build

```bash
npm run build      # dist/
npm run preview    # serves dist/ the way a static host would
```

`scamp build` prerenders every page it can into `dist/`, a folder any
static host serves. A route it cannot prerender stops the build and
says why: a `server` route, or a dynamic route with no `params()` to
enumerate, needs somewhere to run.

That somewhere is an adapter. Install one, name it in `package.json`,
and the build also bundles a server for those routes:

```json
{ "scamp": { "adapter": "@scampjs/adapter-cloudflare" } }
```

See [Deploy to Cloudflare](../reference/deploy-cloudflare.md). Static
routes still become files, so the host serves them directly and the
server answers only what a folder cannot.

## Add a database

```bash
npx scamp add drizzle --dialect sqlite
npm install
npm run db:generate && npm run db:migrate
```

This writes a schema, a `db(env)` client, the drizzle-kit config, the
`db:*` scripts, and a **Database** section in `agent.md`. Read through
it in [Database](../reference/database.md). The `d1` dialect runs on
Cloudflare D1 in production and on a SQLite file locally, with no code
change in between.

## Where to go next

- [Routing](../reference/routing.md) and [`load()`](../reference/load.md)
- [Rendering modes](../reference/rendering-modes.md)
- [API routes](../reference/api-routes.md) under `routes/api/`
- [Database](../reference/database.md)
- [Deploy to Cloudflare](../reference/deploy-cloudflare.md)
- [With the Scamp app](with-the-scamp-app.md), if you design in Scamp
- [CONTRACT.md](../../CONTRACT.md) for the exact file shapes
