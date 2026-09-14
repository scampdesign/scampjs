# The Scamp contract

Contract version: **2**

This is the one document the Scamp framework (this repository) and the
Scamp app implement against. It states shapes, shows the canonical
form, and names the owner of each. The reasoning is in the app
repository's `docs/plans/scamp-framework-plan.md`; the order of work is
in `scamp-framework-tech-plan.md`. Nothing here explains why.

Every fenced example preceded by a `<!-- fixture: … -->` marker is an
exact quote from `packages/framework/fixtures/contract-0/` (or, with a
`<!-- fixture(contract-2): … -->` marker, from `fixtures/contract-2/`),
and a test fails if the two drift. Each fixture is a complete project
in this shape; contract 2 adds files to contract 0 and changes none.

## Versioning

`contract` is an integer, published in two places that a test keeps
equal: the `scampjs.contract` key in the framework's `package.json`,
and `CONTRACT_VERSION` exported from the `scampjs` package root.

```json
{ "name": "scampjs", "version": "0.0.1", "scampjs": { "contract": 0 } }
```

It bumps only when a row of the files or CLI contract changes shape.
Additions never bump it.

| Contract | Introduced by             | Means                                                              |
| -------- | ------------------------- | ------------------------------------------------------------------ |
| 0        | this repository's phase 0 | Documented. Types exported. Nothing runs.                          |
| 1        | this repository's phase 2 | `scamp dev`, the readiness line, `/_views/`, the templates export. |
| 2        | this repository's phase 6 | API handler shapes, adapters, recipes, the Database section.       |

The app declares a supported range and reads the installed package's
`scampjs.contract` on project open (section 4).

---

## 1. Files

### 1.1 Layout

```
my-project/
  views/<Name>/<Name>.tsx           ← structure   (app-owned, regenerated)
  views/<Name>/<Name>.module.css    ← styles      (app-owned, regenerated)
  components/<Name>/<Name>.tsx      ← same shape as a view; canvas default differs
  components/<Name>/<Name>.module.css
  routes/**                         ← logic       (yours; never scanned, never generated)
  routes/api/**                     ← API handlers (yours; section 1.5)
  design/theme.css                  ← tokens and fonts (app-owned)
  design/DESIGN.md                  ← optional
  scamp-env.d.ts                    ← optional Env augmentation (yours)
  scamp.config.json                 ← app-owned; the framework ignores it
  agent.md · CLAUDE.md              ← app-owned; the framework ignores them
  package.json
```

| Folder                                                  | The app                   | The framework                                   |
| ------------------------------------------------------- | ------------------------- | ----------------------------------------------- |
| `views/`, `components/`                                 | Scans, lists, regenerates | Serves each at `/_views/<Name>`; reads `_scamp` |
| `routes/`                                               | Never scans               | Owns routing over it                            |
| `design/theme.css`                                      | Edits                     | Injects into the document shell                 |
| `.scamp/`, `scamp.config.json`, `agent.md`, `CLAUDE.md` | Owns                      | Ignores                                         |

There is no `app/`, no `layout.tsx`, and no `pages/`. The framework
owns the document shell.

### 1.2 The view file

`views/<Name>/<Name>.tsx` in full. Components are the same file shape;
everything in this section applies to both.

<!-- fixture: views/Lobby/Lobby.tsx -->

```tsx
import styles from './Lobby.module.css';
import LinkCard from '@/components/LinkCard/LinkCard';
import RoundTag from '@/components/RoundTag/RoundTag';

type LobbyProps = {
  code?: string;
  joinedLabel?: string;
  players?: Array<{ id: string; label: string; url: string; status: string }>;
  waiting?: boolean;
  canStart?: boolean;
  onCopy?: (id: string) => void;
  onStart?: () => void;
  className?: string;
};

export default function Lobby({
  code = "KZQ4",
  joinedLabel = "2 of 4 joined",
  players = [
    { id: "1", label: "Player 1 · Alex", url: "https://example.com/game/KZQ4/player-1", status: "Joined" },
    { id: "2", label: "Player 2 · Bea", url: "https://example.com/game/KZQ4/player-2", status: "Open" },
  ],
  waiting = true,
  canStart = false,
  onCopy,
  onStart,
  className,
}: LobbyProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>
      <header data-scamp-id="page_header_e1c1" className={styles.page_header_e1c1}>
        <p data-scamp-id="kicker_e1c2" className={styles.kicker_e1c2}>Step 3 of 3</p>
        <h1 data-scamp-id="page_title_e1c3" className={styles.page_title_e1c3}>Share the links</h1>
      </header>
      <section data-scamp-id="code_card_e1d0" className={styles.code_card_e1d0}>
        <p data-scamp-id="code_label_e1d1" className={styles.code_label_e1d1}>Room code</p>
        <h2 data-scamp-id="code_value_e1d2" className={styles.code_value_e1d2}>{code}</h2>
      </section>
      <section data-scamp-id="links_section_e1e0" className={styles.links_section_e1e0}>
        <div data-scamp-id="links_head_e1e1" className={styles.links_head_e1e1}>
          <h2 data-scamp-id="section_title_e1e2" className={styles.section_title_e1e2}>Player links</h2>
          <RoundTag data-scamp-instance-id="inst_7d19" label={joinedLabel} />
        </div>
        <div data-scamp-id="links_list_e1e3" className={styles.links_list_e1e3}>
          {players.map((player) => (
            <LinkCard data-scamp-instance-id="inst_2c40" key={player.id} label={player.label} url={player.url} status={player.status}>
              <button data-scamp-id="copy_button_e1f1" className={styles.copy_button_e1f1} type="button" onClick={() => onCopy?.(player.id)}>Copy link</button>
            </LinkCard>
          ))}
        </div>
        {waiting && (
          <p data-scamp-id="waiting_note_e1f5" className={styles.waiting_note_e1f5}>Waiting for everyone to join</p>
        )}
      </section>
      <button data-scamp-id="start_button_e1f9" className={styles.start_button_e1f9} type="button" disabled={!canStart} onClick={onStart}>Start the game</button>
    </div>
  );
}

export const _scamp = { contract: 0, events: ['onCopy', 'onStart'] } as const;
```

The rules the file follows, in order of appearance:

1. **Imports.** The CSS module first, as `styles`, with a relative
   path. Then one import per referenced component, through the `@/`
   alias, in first-use order. Single quotes. Nothing else is imported.
2. **The props type**, named `<Name>Props`. Every member is optional.
   Members in document order: text and attribute props, then repeat
   props, then show props, then event props, then slots, then
   `className`. The app decides the exact order; the contract requires
   only that every member be optional and that `className?: string` be
   last.
3. **The default export**, a function named `<Name>` destructuring
   every prop with its default in the signature. **The defaults are the
   sample data.** String defaults are double-quoted. Event props and
   slots have no default.
4. **The root element** carries `data-scamp-id="root"` and
   ``className={`${styles.root} ${className ?? ''}`}``.
5. **Every element** carries `data-scamp-id="<id>"` and
   `className={styles.<id>}` with the same id. Attributes are
   double-quoted. Component instances carry
   `data-scamp-instance-id="<id>"` and no `className`.
6. **The `_scamp` export** is the last statement (section 1.4).

Text elements bind with `{name}`; everything else is section 1.3. The
app's parser preserves anything outside this grammar verbatim, and
regenerates only what is inside it. The framework never depends on
more than what is written here.

A view with no bindings still has the props type, the `className`
passthrough, and the `_scamp` export:

<!-- fixture: views/Home/Home.tsx -->

```tsx
import styles from './Home.module.css';

type HomeProps = {
  className?: string;
};

export default function Home({ className }: HomeProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>
      <h1 data-scamp-id="title_a1b1" className={styles.title_a1b1}>Noise With Friends</h1>
      <p data-scamp-id="lede_a1b2" className={styles.lede_a1b2}>A party game for four people and one phone each.</p>
    </div>
  );
}

export const _scamp = { contract: 0, events: [] } as const;
```

A component with a default slot declares `children?: React.ReactNode`
and renders `{children}`. Named slots are `name?: React.ReactNode`
rendered as `{name}`; an instance fills one with `name={<…>}`. The
`React` namespace resolves through the `paths` mapping in section 1.8,
so the file is unchanged under React and Preact alike.

<!-- fixture: components/LinkCard/LinkCard.tsx -->

```tsx
type LinkCardProps = {
  label?: string;
  url?: string;
  status?: string;
  children?: React.ReactNode;
  className?: string;
};
```

### 1.3 The binding grammar

Five kinds. Paths are prop names and member paths only; there are no
expressions. Anything a view cannot say with these is computed in the
route file and passed as a string or a boolean.

| Kind      | App model field              | Emitted form                                                            | Inferred prop type                                                                                      |
| --------- | ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Text      | `prop`                       | `{name}`; inside a repeat `{row.field}`                                 | `string`                                                                                                |
| Attribute | `bind[attr] = prop`          | `attr={name}`; a boolean attribute inverted is `attr={!name}`           | `string`, or `boolean` for boolean attributes                                                           |
| Event     | `on[event] = prop`           | `onX={name}`; inside a repeat `onX={() => name?.(row.key)}`             | `() => void`, or `(key: string) => void` inside a repeat                                                |
| Repeat    | `repeat = { over, as, key }` | `{list.map((row) => (…))}` with `key={row.key}` on the repeated element | `Array<{ … }>` from the sample rows; a field is `number` when every sample parses as one, else `string` |
| Show      | `showIf = prop`              | `{flag && (…)}`                                                         | `boolean`                                                                                               |

Canonical forms, each quoted from the Lobby view above:

<!-- fixture: views/Lobby/Lobby.tsx -->

```tsx
        <h2 data-scamp-id="code_value_e1d2" className={styles.code_value_e1d2}>{code}</h2>
```

<!-- fixture: views/Lobby/Lobby.tsx -->

```tsx
      <button data-scamp-id="start_button_e1f9" className={styles.start_button_e1f9} type="button" disabled={!canStart} onClick={onStart}>Start the game</button>
```

<!-- fixture: views/Lobby/Lobby.tsx -->

```tsx
          {players.map((player) => (
            <LinkCard data-scamp-instance-id="inst_2c40" key={player.id} label={player.label} url={player.url} status={player.status}>
              <button data-scamp-id="copy_button_e1f1" className={styles.copy_button_e1f1} type="button" onClick={() => onCopy?.(player.id)}>Copy link</button>
            </LinkCard>
          ))}
```

<!-- fixture: views/Lobby/Lobby.tsx -->

```tsx
        {waiting && (
          <p data-scamp-id="waiting_note_e1f5" className={styles.waiting_note_e1f5}>Waiting for everyone to join</p>
        )}
```

Rules:

- The repeat variable is the `as` name; its key is `row.<key>`, and
  `key` defaults to `id` when the sample rows have one, else the index.
- Inside a repeat, text and attributes bind to `row.<field>` and event
  props receive `row.<key>`.
- Show wraps one element or one instance. Nested show and repeat are
  allowed; the canvas renders them by reimplementation, never by
  evaluation.
- The inverted boolean is a Data-tab checkbox, emitted as `!name`, and
  parsed back as the same. No other operator appears in a view.
- Sample values are the defaults. Boolean samples flip the show and
  attribute bindings on the canvas; array samples become the rows.

### 1.4 View metadata

Every view and component ends with one named export:

<!-- fixture: views/Lobby/Lobby.tsx -->

```tsx
export const _scamp = { contract: 0, events: ['onCopy', 'onStart'] } as const;
```

Its type is `ViewMeta` from `scampjs/runtime`:

| Field      | Meaning                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `contract` | The contract version the file was written for. The framework refuses a view from a newer major. |
| `events`   | The prop names that are event handlers, in props-type order. Empty when there are none.         |

The build reads it to decide islands: a static route whose views all
have empty `events` ships no JavaScript. Fields may be added without
a bump. The export is harmless under Next, Remix, or React.

### 1.5 The route file

A file under `routes/` at any depth. Segment syntax: `index.tsx` for
the folder's path, `[param]`, `[...rest]`, and `(group)` for a folder
that adds no segment. `routes/api/**` holds API handlers instead of
pages (below).

<!-- fixture: routes/game/[token]/lobby.tsx -->

```tsx
import { useState } from 'preact/hooks';
import type { LoadContext, RouteProps } from 'scampjs/runtime';
import Lobby from '@/views/Lobby/Lobby';
import { loadGame, startGame } from '@/lib/game';

export const render = 'client';

export async function load({ params, env }: LoadContext<{ token: string }>) {
  return { game: await loadGame(env.DB, params.token) };
}

export default function LobbyRoute({ params, data }: RouteProps<typeof load>) {
```

| Export    | Required | Shape                                                                                                                                |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `default` | yes      | A component receiving `RouteProps<typeof load>`: `{ params, data }`.                                                                 |
| `load`    | no       | `(ctx: LoadContext<P>) => T \| Promise<T>`. Runs on the server or at build time. `data` is `Awaited<T>`.                             |
| `render`  | no       | `'static' \| 'server' \| 'client'`. Default `static`.                                                                                |
| `params`  | no       | `() => P[] \| Promise<P[]>`. A static route with `load()` prerenders one page per entry; without it, such a route falls to `server`. |

`LoadContext` is the whole of what a route file sees of the server:

```ts
type LoadContext<P extends Params = Params> = {
  params: P;          // matched route params
  request: Request;   // the standard Request
  env: Env;           // adapter-filled bindings and secrets
};
```

Never a Hono context. A route file imports nothing from Hono.

The simplest route renders a view and nothing else:

<!-- fixture: routes/index.tsx -->

```tsx
import Home from '@/views/Home/Home';

export const render = 'static';

export default function HomeRoute() {
  return <Home />;
}
```

"Compute in logic, bind in the view": formatting, arithmetic, and
mapping from a schema to a view's props all happen in the route file.

**API handlers.** A file under `routes/api/` answers its path with the
same segment syntax, the `api` prefix included:
`routes/api/games/[token]/start.ts` is `/api/games/:token/start`. Two
shapes, and the plain one is the default in every template:

<!-- fixture(contract-2): routes/api/games/[token]/start.ts -->

```ts
import type { LoadContext } from 'scampjs/runtime';
import { startGame } from '@/lib/game';

export const POST = async ({ params, env }: LoadContext<{ token: string }>) => {
  const game = await startGame(env.DB, params.token);
  return Response.json({ game });
};
```

One named export per method (`GET`, `HEAD`, `POST`, `PUT`, `PATCH`,
`DELETE`, `OPTIONS`), typed `ApiHandler<P>` from `scampjs/runtime`:
`(ctx: LoadContext<P>) => Response | Promise<Response>`. A method the
file lacks is `405` with an `Allow` header; `HEAD` falls back to `GET`.
Nothing is imported from Hono.

The other shape is a default-exported Hono app, mounted at the file's
path, for routing inside the file, middleware, and Hono's typed client:

<!-- fixture(contract-2): routes/api/health.ts -->

```ts
import { Hono } from 'hono';

export default new Hono()
  .get('/', (c) => c.json({ ok: true }))
  .get('/deep', (c) => c.text('deep'));
```

`/api/health` and `/api/health/deep` both reach it; its routes are
relative to the mount, and params in the file's path are visible to
it. The exact file wins over a mounted app on a prefix.

### 1.6 `Env`

`Env` is an empty interface in `scampjs/runtime`. A project augments
it once, in `scamp-env.d.ts` at the root:

<!-- fixture: scamp-env.d.ts -->

```ts
declare module 'scampjs/runtime' {
  interface Env {
    DB: unknown;
  }
}
```

Each adapter documents what it puts in `env`. Contract 0 specifies no
adapter.

### 1.7 `design/theme.css`

Tokens in `:root`, the `body` rules, and any `@font-face` or
`@import`. The framework injects it, first, into the document shell of
every route and of `/_views/<Name>`. There is no `layout.tsx`.

<!-- fixture: design/theme.css -->

```css
body {
  margin: 0;
  min-height: 100vh;
  font-family: var(--font-sans);
}
```

### 1.8 `package.json` and `tsconfig.json`

<!-- fixture: package.json -->

```json
  "scripts": {
    "dev": "scamp dev",
    "build": "scamp build",
    "preview": "scamp preview"
  },
  "dependencies": {
    "preact": "^10.29.0",
    "scampjs": "^0.0.1"
  }
```

The app scaffolds `scampjs` pinned to the newest version inside its
supported range. The `@/` alias resolves to the project root, in the
framework and in the project's `tsconfig.json`, and `react` maps to
`preact/compat` so views that name `React.ReactNode` type-check:

<!-- fixture: tsconfig.json -->

```json
    "paths": {
      "@/*": ["./*"],
      "react": ["./node_modules/preact/compat/"],
      "react-dom": ["./node_modules/preact/compat/"]
    }
```

A project on another framework sets the same alias and the files run
unchanged. That is the portability promise.

### 1.9 `scampjs/runtime` exports

| Export           | Kind      | Meaning                                                                                                    |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `LoadContext`    | type      | Section 1.5.                                                                                               |
| `RouteProps`     | type      | Section 1.5.                                                                                               |
| `RenderMode`     | type      | `'static' \| 'server' \| 'client'`.                                                                        |
| `Params`         | type      | `Record<string, string>`.                                                                                  |
| `Env`            | interface | Section 1.6.                                                                                               |
| `ViewMeta`       | type      | Section 1.4.                                                                                               |
| `useParams()`    | function  | The matched params, during server render and after hydration in the browser.                               |
| `Link`           | component | An anchor: `<Link href="/about">About</Link>`. A full navigation; there is no client router at contract 1. |
| `navigate(href)` | function  | `location.assign` in the browser; a no-op on the server.                                                   |

Views import none of these.

### 1.10 The `scamp` key in `package.json`

The framework's own settings, declarative so the app can read them:

```json
{ "scamp": { "adapter": "@scampjs/adapter-cloudflare" } }
```

| Key       | Meaning                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| `adapter` | The deploy adapter package `scamp build` lays the build out with (section 2.6). |

Absent, the build is the static folder of section 2.3.

### 1.11 What the framework ignores

`scamp.config.json`, `.scamp/`, `agent.md`, `CLAUDE.md`, and
`design/DESIGN.md` belong to the app or to the user. The framework
never reads them and never writes them.

---

## 2. CLI

Implemented at contract 1, consumed by the app from its phase 3. The
binary is `scamp`.

### 2.1 `scamp dev [--port <n>] [--json]`

Starts the dev server: Vite for assets and HMR, the Hono app for
routes, `load()`, and `/_views/`.

**Readiness.** Exactly one line on stdout, on its own line, once the
server accepts connections:

```
scamp dev ready http://127.0.0.1:<port>
```

Nothing else on stdout before it. The app's ready detector matches
this line and nothing else. `--port` requests a port; without it the
server picks a free one and reports it in the line.

**Exit codes.** `0` on a clean shutdown (SIGINT or SIGTERM), `1` when
the server cannot start, and the reason on stderr.

**`--json`.** One JSON object per line on stdout, after the readiness
line, one per request and one per failure:

```json
{ "t": "2026-09-10T15:00:00.000Z", "kind": "request", "method": "GET", "path": "/game/KZQ4/lobby", "status": 200, "ms": 12 }
{ "t": "2026-09-10T15:00:01.000Z", "kind": "error", "path": "/game/KZQ4/lobby", "message": "…", "stack": "…" }
```

Without `--json`, the same information is printed for humans on
stderr, and its format is not part of the contract.

**What the dev server does with a route.** It runs `load()` with a
`LoadContext` whose `env` is `process.env` overlaid with the project's
`.dev.vars` (one `KEY=value` per line), renders the route on the
server inside the document shell with `design/theme.css` first and
every stylesheet the route's modules import inlined after it, and:

- for `render = 'client'`, serialises `{ params, data }` into the page
  and hydrates the route in the browser;
- for `static` and `server`, ships no JavaScript beyond Vite's client.
  Islands from `_scamp.events` arrive with `scamp build`.

Any change under the project reloads open pages. A route error is a
`500` whose body is the message and stack.

### 2.2 `/_views/<Name>` and `/_views/`

`GET /_views/<Name>` renders `views/<Name>/<Name>.tsx` with its
defaults inside the document shell with `design/theme.css`, as HTML.
This is the app's view preview and the parity harness's target. An
unknown name is `404`.

`GET /_views/` returns `application/json`: the view names, sorted,
as `{ "views": ["Home", "Lobby"] }`. Components are not listed.

### 2.3 `scamp build`

Prerenders the project into `dist/`, a folder any static host serves:
`dist/<path>/index.html` per page (`dist/index.html` for `/`), the
stylesheets and scripts under `dist/assets/`, and `public/` copied over
the result. Exit `0` with a summary line on stdout, `1` with every
refused route and its fix on stderr, and nothing written when any route
is refused.

Per route, from its exports:

| Route                                     | Result                                             |
| ----------------------------------------- | -------------------------------------------------- |
| `static`, no dynamic segment              | One page; `load()` runs at build time              |
| `static`, dynamic segments, `params()`    | One page per entry of `params()`                   |
| `static`, dynamic segments, no `params()` | Refused: add `params()` or use a server adapter    |
| `client`                                  | As `static`, and the page hydrates in the browser  |
| `server`                                  | Refused until a server adapter exists (contract 2) |

`load()` receives a `LoadContext` whose `request` is a `Request` for the
page's URL and whose `env` is `process.env` overlaid with `.dev.vars`.

**JavaScript.** A route ships JavaScript when it is `client`, or when a
view or component it renders declares event props in its `_scamp`
export. Otherwise its pages carry HTML and stylesheets only. The unit
that hydrates is the route: its handlers are defined in the route
file, so the page carries `{ params, data }` as JSON and the route
renders again in the browser from them. The browser bundle imports only
the route's default export, so `load()` and what it alone imports are
not shipped.

**Stylesheets.** Every page links `design/theme.css` first, then the
CSS modules its route reached, as hashed files under `dist/assets/`.

### 2.4 `scamp preview [--port <n>]`

Serves `dist/` as a static host would: a path resolves to
`<path>/index.html` or to a file, with no rewrites, and anything else is
`404`. Readiness is one line on stdout,
`scamp preview ready http://127.0.0.1:<port>`, in the shape of
section 2.1.

### 2.5 `scamp add <recipe> [--dialect <d>] [--force]`

Applies a recipe from the templates export (section 3.2) to the project
in the working directory: new files are written, `package.json`,
`scamp-env.d.ts`, `.dev.vars`, `.gitignore`, and `agent.md` gain what
the recipe adds and keep everything else. A recipe file that exists with
other contents stops the command unless `--force`; applying a recipe
twice changes nothing. Exit `0`, the files written and the commands to
run next on stdout.

### 2.6 Adapters and the server bundle

When `package.json` names an adapter, `scamp build` still prerenders
every route section 2.3 can, then bundles the server into one ES module
whose default export is the Hono app — every page route and API route
imported statically — and hands the adapter the static folder, the
bundle, the route table, and the project name through `scampjs/adapter`:

```ts
type Adapter = {
  name: string;
  serverTarget: 'webworker' | 'node';
  build: (ctx: AdapterBuildContext) => Promise<void>;
};
```

With an adapter, `render = 'server'` routes and dynamic routes without
`params()` render per request from the bundle instead of being refused.
`env` in `load()` and API handlers is what the host hands the app's
`fetch()`; each adapter documents it. `@scampjs/adapter-cloudflare`
writes `dist/_worker.js` beside the static folder, and a `wrangler.jsonc`
on the first build; `env` is the Worker's bindings.

-------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `scamp build` | contract 1 (phase 4): prerender `static`, bundle `server`, SPA entry for `client`; islands from `_scamp.events`. |
| `scamp preview` | contract 1 (phase 4): serve the build as an adapter would. |
| `scamp add <recipe>` | contract 2 (phase 6): apply a recipe from the templates export; `drizzle` first. |

---

## 3. Templates export

`scampjs/templates` is how `create-scampjs` and the app's New project
scaffold identical files from one source. Contract 1 exports the
implementations `projectTemplate`, `viewTemplate`, and
`componentTemplate`, with these types:

```ts
type FileMap = Record<string, string>;                       // relative path → contents
type ProjectTemplate = (opts: { name: string }) => FileMap;  // views/, routes/index.tsx, design/, package.json, tsconfig.json
type ViewTemplate = (name: string) => FileMap;               // views/<Name>/<Name>.tsx + .module.css
type ComponentTemplate = (name: string) => FileMap;          // components/<Name>/<Name>.tsx + .module.css
```

A scaffolded view or component is the empty form of section 1.2: the
imports, the props type with only `className`, the root element, and
the `_scamp` export with empty `events`. The project template writes
`package.json` (with `scampjs` pinned to the version that wrote it),
`tsconfig.json`, `scamp-env.d.ts`, `.gitignore`, an `agent.md` stub,
`design/theme.css`, `routes/index.tsx`, and `views/Home/`.

### 3.2 Recipes

A recipe is new files plus additions to files a project has, applied by
`applyRecipe(files, recipe)` from the templates export, which
`scamp add` and `create-scampjs` both call:

```ts
type Recipe = {
  name: string;
  files: FileMap;                          // new files; a differing existing file is a conflict
  dependencies: Record<string, string>;    // merged into package.json, existing entries kept
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  devVars: Record<string, string>;         // .dev.vars lines, keys the project sets kept
  env: Record<string, string>;             // Env fields → scamp-env.d.ts augmentation
  envReferences: string[];                 // /// <reference types="…" /> the fields need
  gitignore: string[];
  agentMd: string;                         // appended once, under a marker
};
```

**`drizzle`**, the first recipe, takes a dialect — `sqlite`, `postgres`,
or `d1` — and writes `db/schema.ts`, `lib/db.ts` exporting `db(env)`,
`drizzle.config.ts`, the `db:generate`, `db:migrate`, and `db:studio`
scripts, `DATABASE_URL` in `.dev.vars`, the `Env` fields, and the
**Database** section of `agent.md`. The `d1` dialect's `db(env)` uses
`env.DB` when the binding exists and a SQLite file otherwise, so the
same project runs locally and on Cloudflare with no code change.

---

## 4. Compatibility

Owned by the app. Stated here so the framework knows its one duty.

- The app declares a supported `contract` range in its project config.
- On project open it reads `node_modules/scampjs/package.json` and its
  `scampjs.contract` key. Outside the range, it shows a banner offering
  an upgrade, in the style of its Next migration report.
- New projects are scaffolded with `scampjs` pinned to the newest
  version inside the range.

The framework's duty: keep `scampjs.contract` accurate, bump it only on
a shape change, and keep `./package.json` in the package's `exports`
map so the app can read it.

---

## Fixture index

`packages/framework/fixtures/contract-0/`:

| File                                               | Demonstrates                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `views/Lobby/Lobby.tsx` + `.module.css`            | Every binding kind; instances; a slot child; `_scamp` with events |
| `views/Home/Home.tsx` + `.module.css`              | A view with no bindings                                           |
| `components/LinkCard/LinkCard.tsx` + `.module.css` | Attribute binding on a component; a default slot                  |
| `components/RoundTag/RoundTag.tsx` + `.module.css` | The smallest component                                            |
| `routes/index.tsx`                                 | A static route with no `load()`                                   |
| `routes/game/[token]/lobby.tsx`                    | A param segment, `load()`, `render`, "compute in logic"           |
| `lib/game.ts`                                      | Application code the framework never reads                        |
| `scamp-env.d.ts`                                   | The `Env` augmentation                                            |
| `design/theme.css`                                 | Tokens and the `body` rules                                       |
| `package.json`, `tsconfig.json`                    | Scripts, dependencies, the `@/` alias, the `react` mapping        |

`packages/framework/fixtures/contract-2/` is the same project with what
contract 2 adds:

| File                                | Demonstrates                                 |
| ----------------------------------- | -------------------------------------------- |
| `routes/api/games/[token]/start.ts` | A plain `POST` handler with params and `env` |
| `routes/api/health.ts`              | A default-exported Hono app and its sub-path |
