# Phase 0 — bootstrap the framework repo — Plan

Status: **in progress.** All eight decisions were accepted as
recommended on 2026-09-10 and the scaffold is built; see "Progress" at
the end for what is done and what still needs you.

Source: "Phase 0" of `scamp/docs/plans/scamp-framework-tech-plan.md`,
with the reasoning in `scamp/docs/plans/scamp-framework-plan.md` and
the public copy in `scamp/docs/website/scamp-framework.md`. This plan
turns that phase into a task list, records what was checked before
writing it, and lists the decisions that need an answer before work
starts. Where it goes further than the tech plan, it says so.

## What phase 0 is for

A publishable, empty package with the contract written down. Nothing
ships to users. Two consumers wait on it:

- **Phase 1 (app)** points `agent.md` at the framework's exported
  types, and its generator has to produce files that match
  `CONTRACT.md` byte for byte.
- **Phase 2 (framework)** builds `scamp dev` against the CLI contract
  written here, and bumps the contract from `0` to `1`.

So the deliverable is text and types, not a running program. The one
thing that must be true at the end is that the contract is precise
enough for the app's parser and generator to implement without
guessing.

## What was checked before writing this

Checked on 2026-09-10 from this machine.

| Check                                                       | Result                                                                                                                                                                      | Consequence                                                                                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@scamp` npm scope                                          | **Taken.** An npm user named `scamp` exists, and a user's name is also their scope. `npm org ls scamp` reports that user as owner.                                          | `@scamp/framework` cannot be published. Decision 1 below.                                               |
| Unscoped `scamp` on npm                                     | A 2021 RabbitMQ client by another author, one release, no `bin`.                                                                                                            | A CLI binary named `scamp` does not collide. Only the package name is unavailable.                      |
| `scampjs`, `create-scampjs`, `create-scamp`, `@scampjs/*`   | All free.                                                                                                                                                                   | Any of these can be claimed.                                                                            |
| GitHub `angiehemans/scampjs`, `angiehemans/scamp-framework` | Neither exists.                                                                                                                                                             | The repo is created in this phase.                                                                      |
| npm login on this machine                                   | Not logged in, no token in `~/.npmrc`.                                                                                                                                      | Claiming names is a manual step for you.                                                                |
| `_scamp` view metadata                                      | Does not exist in the app today. The generator emits `data-scamp-id`, `data-scamp-instance-id`, a `<Name>Props` type with string defaults, and the `className` passthrough. | Phase 0 defines it from scratch. Decision 4.                                                            |
| App tooling                                                 | Node 24, TypeScript 5.x strict with `noUncheckedIndexedAccess`, Vitest, no ESLint or Prettier config.                                                                       | Mirror the TypeScript flags so both repos check the contract types identically. Decision 6 covers lint. |
| Vite 7 engine floor                                         | `^20.19.0 \|\| >=22.12.0`                                                                                                                                                   | The published packages declare that floor even though Vite arrives in phase 2.                          |

## Decisions needed before work starts

### Decision 1 — names (blocks everything)

The tech plan's `@scamp/framework` and `npm create scamp` are not
available. Three options:

|                     | Framework            | Scaffolder        | Adapters             | Imports read as                    |
| ------------------- | -------------------- | ----------------- | -------------------- | ---------------------------------- |
| **A (recommended)** | `scampjs`            | `create-scampjs`  | `@scampjs/adapter-*` | `scampjs/runtime`                  |
| B                   | `@scampjs/framework` | `@scampjs/create` | `@scampjs/adapter-*` | `@scampjs/framework/runtime`       |
| C                   | `@scamp/framework`   | `create-scamp`    | `@scamp/adapter-*`   | `scamp/runtime` (as the plans say) |

Option C needs the current holder of the `scamp` username to hand over
the scope. npm's dispute process does not reclaim a scope that is a
real account name, so treat C as unavailable.

Option A is recommended. It matches this folder's name, keeps imports
short, and `npm create scampjs` is a clean command. The CLI binary
stays `scamp` under every option. The `@scampjs` org is created in
this phase regardless, so adapters have a home and the scope is held.

Whatever is chosen, the two plans and the website copy in the app repo
still say `@scamp/framework`, `scamp/runtime`, and `npm create scamp`.
Updating them is a task in this phase (see "Tasks in the app repo").

- yes lets go with a - scampjs

### Decision 2 — reserve the bare names by publishing

Creating the `@scampjs` org reserves the scope with no publish. The
bare names `scampjs` and `create-scampjs` are only reserved by
publishing something. The tech plan stops at `npm publish --dry-run`.

Recommendation: go one step further and publish `scampjs@0.0.1` at
the end of the phase. It is not an empty placeholder: it carries the
runtime types, `CONTRACT.md`, and `contract: 0`, and its README says
nothing runs yet. For `create-scampjs`, publish `0.0.1` whose `bin`
prints one line pointing at the repository and exits non-zero. Both
are honest packages, so npm's spam policy is not a concern.

If you would rather not publish anything before phase 2, the risk is
only that someone else takes `scampjs` in the meantime.

yes go with your rec

### Decision 3 — public from the first commit

The framework is MIT and the point of a separate repo is that the
package is visible on its own. Recommendation: public from the first
commit. Nothing in phase 0 is sensitive, and the app repo's plans
already describe the design in full.

yes

### Decision 4 — the shape of the `_scamp` view metadata

Both plans rely on the build knowing which views declare event props,
so a static route can ship zero JavaScript when none do. The plans call
this the `_scamp` metadata but never define it. Three ways to get it:

|                                | How                                                                                                                                                                                     | Cost                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Named export (recommended)** | `export const _scamp = { contract: 0, events: ['onCopy', 'onStart'] } as const;` at the bottom of every view. The app's generator writes it; the build imports the module and reads it. | One line per view. Readable by any JavaScript tool. Harmless under Next or React.                    |
| Infer from the props type      | The build parses `<Name>Props` and finds function-typed members.                                                                                                                        | Needs the TypeScript checker inside the build. Heavy for a package meant to be read in an afternoon. |
| JSDoc comment                  | A `/** @scamp events: onCopy, onStart */` block.                                                                                                                                        | Needs a comment parser; invisible to type checking; easy to drift.                                   |

The recommended shape is deliberately small. `contract` lets the
framework refuse a view written for a newer grammar; `events` is the
only field the build needs today. Additions later do not bump the
contract.

-yes go with your rec

### Decision 5 — where the contract version lives

The tech plan says `contract: 0` in `package.json`. Recommendation: a
namespaced key, so it can never collide with an npm field:

```json
{ "name": "scampjs", "version": "0.0.1", "scampjs": { "contract": 0 } }
```

The same number is exported as `CONTRACT_VERSION` from the package
root. The app reads the JSON key from the installed package on project
open, as the tech plan's phase 3 describes.

yes go with your rec

### Decision 6 — lint and format

The tech plan lists "lint" in CI. The app repo has neither ESLint nor
Prettier configured. Recommendation: ESLint flat config with the
typescript-eslint type-checked preset, plus Prettier for formatting,
both run in CI. Public packages get outside contributors, and a
formatter removes a whole category of review comments. If you prefer
to match the app, drop both and let `tsc --noEmit` be the lint step.

yes

### Decision 7 — tag scheme for a workspace

Several packages will release from one repo at different versions.
Recommendation: tags of the form `scampjs@0.1.0` and
`create-scampjs@0.1.0`, so a tag names exactly one package. The release
workflow parses the tag to choose the workspace to publish.

yes sounds good

### Decision 8 — TypeScript major

The app is on TypeScript 5. Newer majors are available. Recommendation:
match the app for phase 0 and 1 so both repos check the shared types
with the same compiler, and revisit when phase 2 pins Vite, Preact,
and Hono.

sounds good.

## Repository layout

```
scampjs/
  package.json               ← private; workspaces: packages/*
  tsconfig.base.json         ← strict, noUncheckedIndexedAccess, NodeNext
  CONTRACT.md                ← the contract, versioned (see below)
  README.md                  ← what this is, status, pointer to CONTRACT.md
  LICENSE                    ← MIT
  CLAUDE.md                  ← rules for agents working in this repo
  .nvmrc                     ← 24
  .editorconfig  .gitignore  .npmrc (provenance / access defaults)
  .github/workflows/
    ci.yml                   ← push + PR: lint, typecheck, test, build, dry-run publish
    release.yml              ← tags: build, then dry-run publish (real publish from phase 2)
  docs/
    plans/                   ← this file
    notes/                   ← same convention as the app repo
  packages/
    framework/               ← npm: scampjs
      package.json           ← exports ".", "./runtime", "./templates"; scampjs.contract = 0
      src/
        index.ts             ← CONTRACT_VERSION; nothing else yet
        runtime/index.ts     ← Env, LoadContext, RouteProps, RenderMode, ViewMeta
        templates/index.ts   ← the export's types only; phase 2 fills it
      fixtures/contract-0/   ← the canonical project CONTRACT.md quotes from
      test/
    create-scampjs/          ← npm: create-scampjs; a one-line stub until phase 4
```

`packages/adapter-*` arrive in phase 6. Nothing here imports Electron,
React, Preact, Vite, or Hono. Phase 0 has zero runtime dependencies.

### Tooling choices

- **Modules.** ESM only (`"type": "module"`), `module` and
  `moduleResolution` set to `NodeNext` so the `exports` map resolves
  the same way for every consumer. This differs from the app's
  `Bundler` setting on purpose: the app is bundled, a published package
  is not.
- **Build.** Plain `tsc` emitting JavaScript and declarations to
  `dist/`. No bundler. Phase 2 can add one for the CLI if it needs it.
- **Tests.** Vitest. Type-level assertions with `expectTypeOf` for the
  runtime types, plus ordinary tests that the fixtures and
  `CONTRACT.md` agree (see "Fixtures").
- **Engines.** `"node": "^20.19.0 || >=22.12.0"` on both published
  packages, which is Vite 7's floor. Development on Node 24 via
  `.nvmrc`, matching the app.
- **CI runners.** Linux only. Nothing here is platform-specific.

## `CONTRACT.md`

This is most of the work. It is the one document both repos implement
against, so it is written as a specification, not an explanation: each
section states a shape, shows the canonical form, and says which repo
owns it. The reasoning stays in the app repo's plans.

### Versioning rule

`contract` is an integer. It bumps only when a row of the files or CLI
contract changes shape; additions never bump it. Contract `0` means
"documented, nothing runs". Phase 2 ships `1`; phase 6 ships `2`.

### Section 1 — files

1. **Layout.** The project tree from the framework plan: `views/`,
   `components/`, `routes/`, `design/theme.css`, `design/DESIGN.md`,
   `scamp.config.json`, `agent.md`, `package.json`. Which folders the
   app scans (`views/`, `components/`) and which it never does
   (`routes/`).
2. **The view file.** The exact canonical form of
   `views/<Name>/<Name>.tsx`: import order, the `<Name>Props` type with
   every member optional, the default export with destructured
   defaults, `data-scamp-id="root"` with the `className` passthrough,
   one `data-scamp-id` and one `className={styles.<id>}` per element,
   `data-scamp-instance-id` on component instances, and the `_scamp`
   export last. Components are the same file shape; the contract says
   so once.
3. **The binding grammar.** Five kinds and nothing else. For each: the
   app-side model field, the emitted form, and the inferred type.

   | Kind      | Emitted form                                                | Inferred prop type                                                                |
   | --------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
   | Text      | `{name}`, or `{row.field}` inside a repeat                  | `string`                                                                          |
   | Attribute | `attr={name}`; boolean inverted as `attr={!name}`           | `string` or `boolean`                                                             |
   | Event     | `onX={name}`; inside a repeat `onX={() => name?.(row.key)}` | `() => void` or `(key: string) => void`                                           |
   | Repeat    | `{list.map((row) => (…))}` with `key={row.key}`             | `Array<{ … }>` from the sample rows; a field is `number` when every sample parses |
   | Show      | `{flag && (…)}`                                             | `boolean`                                                                         |

   Paths are prop names and member paths only, never expressions.
   Defaults are the sample data. Anything outside the grammar is
   preserved verbatim by the app's parser; the contract states that so
   the framework never comes to depend on more.

4. **View metadata.** The `_scamp` export from Decision 4, with its
   type.
5. **The route file.** A default-exported component; optional
   `load(ctx: LoadContext)`; optional `export const render` with the
   three values and `static` as the default; optional `params()` for
   prerendering a static route with `load()`. `RouteProps<typeof load>`
   is `{ params, data }`. Segment syntax: `index.tsx`, `[param]`,
   `[...rest]`, `(group)`. `routes/api/**` is named as reserved for
   contract 2 and given no shape yet.
6. **`design/theme.css`.** Injected into the document shell by the
   framework. Tokens in `:root`, the `body` font rule, fonts, as the
   app's `app/theme.css` is today. There is no `layout.tsx`.
7. **The `@/` alias.** Resolves to the project root in the framework,
   and the contract says a project on another framework sets the same
   alias.
8. **A project's `package.json`.** The `dev`, `build`, and `preview`
   scripts; `scampjs` and `preact` as dependencies; the pinned range
   the app writes on scaffold.
9. **What the framework ignores.** `scamp.config.json`, `.scamp/`,
   `agent.md`, `CLAUDE.md`. They are the app's, and the framework never
   reads them.

### Section 2 — CLI

Specified now, implemented in phase 2, consumed by the app in phase 3.

1. **`scamp dev [--port <n>] [--json]`.** The readiness line, exactly
   `scamp dev ready http://127.0.0.1:<port>`, printed once on stdout on
   its own line. Exit codes. With `--json`, one JSON object per line on
   stdout for each request: `{ "t", "kind": "request", "method",
"path", "status", "ms" }`, and `{ "kind": "error", … }` for a failed
   `load()`. The app's request-log view is written against this shape.
2. **`/_views/<Name>`.** Renders `views/<Name>/<Name>.tsx` with its
   defaults inside the document shell with `theme.css`. Unknown name is
   a 404. `/_views/` with no name returns a JSON list of view names, so
   the app and the parity harness can enumerate without scanning disk.
   This index is an addition to the tech plan; it costs nothing and
   removes a filesystem dependency from the app.
3. **`scamp build`, `scamp preview`, `scamp add`.** Names reserved and
   one-line descriptions. Shapes arrive with contracts 1 and 2.

### Section 3 — templates export

`scampjs/templates` exports functions returning a map of relative path
to file contents:

```ts
type FileMap = Record<string, string>;
export type ProjectTemplate = (opts: { name: string }) => FileMap;
export type ViewTemplate = (name: string) => FileMap;
export type ComponentTemplate = (name: string) => FileMap;
```

Phase 0 ships the types and the documentation. The app's
`src/shared/templates/` is the reference implementation until phase 2
ports it, at which point `create-scampjs` and the app's New project
produce identical files from this one source.

### Section 4 — compatibility

Owned by the app, referenced here: the app declares a supported
`contract` range, reads the installed package's `scampjs.contract` on
open, and shows a banner outside the range. The framework's only duty
is to keep that key accurate.

## Runtime types

`packages/framework/src/runtime/index.ts`, exported as
`scampjs/runtime`. Type-only in this phase; the helpers (`Link`,
`useParams`, `navigate`) come in phase 2.

```ts
// Augmented per project: declare module 'scampjs/runtime' { interface Env { DB: D1Database } }
// An interface, not a type, because declaration merging is the point.
export interface Env {}

export type Params = Record<string, string>;

export type LoadContext<P extends Params = Params> = {
  params: P;
  request: Request;
  env: Env;
};

export type RouteProps<L = undefined> = {
  params: Params;
  data: L extends (...args: never[]) => infer R ? Awaited<R> : undefined;
};

export type RenderMode = 'static' | 'server' | 'client';

export type ViewMeta = {
  readonly contract: number;
  readonly events: readonly string[];
};
```

Tests: `RouteProps<typeof load>['data']` resolves to the awaited return
type; a route without `load()` gets `undefined`; the `Env` augmentation
in a fixture `scamp-env.d.ts` type-checks; `LoadContext<{ token: string }>`
narrows `params`.

## Fixtures

`packages/framework/fixtures/contract-0/` is a tiny complete project:
the Lobby view from the framework plan (all five binding kinds), a Home
view with no bindings, a `LinkCard` component, `routes/index.tsx`,
`routes/game/[token]/lobby.tsx`, `design/theme.css`, and
`package.json`.

`CONTRACT.md` quotes from these files rather than carrying its own
copies, and a test asserts every fenced example in `CONTRACT.md` is a
substring of a fixture file. That is how the contract is kept from
drifting.

The fixture is also how the tech plan's exit criterion, "`CONTRACT.md`
matches what phase 1 generates", becomes mechanical: phase 1 adds a
test in the app that builds the Lobby element model, runs the
generator, and compares the output to `fixtures/contract-0/views/Lobby/Lobby.tsx`
byte for byte. Phase 2 runs `scamp dev` on the same fixture. One file,
three consumers.

## CI

- **`ci.yml`** on push and pull request: `npm ci`, lint, typecheck,
  test, build, then `npm publish --dry-run --workspaces`. Node 24,
  Ubuntu.
- **`release.yml`** on tags matching `*@*`: build, then a dry-run
  publish of the named workspace. Phase 2 flips it to a real publish.
  Use npm trusted publishing (OIDC from GitHub Actions, with
  provenance) rather than a long-lived token, so no secret is stored.

## `CLAUDE.md` for this repo

Short, in the style of the app's. The rules that matter here:

- The size target is a review criterion: the package stays at
  conventions plus tooling on Vite and Hono, small enough to read in an
  afternoon. Anything that grows past that becomes an adapter.
- No Electron, no React, no app-repo imports. Ever.
- `CONTRACT.md` changes ship with a fixture change and a test change in
  the same commit. A shape change bumps `contract`; an addition does
  not.
- Route files never see Hono. `load()` and API handlers get
  `LoadContext` only.
- Same TypeScript rules as the app: no `any`, `type` over `interface`
  except for declaration merging, explicit return types.

## Tasks, in order

1. **Decide 1 through 8** by reviewing this document.
2. **Claim names.** Log in to npm; create the `@scampjs` org. If
   Decision 2 is yes, the placeholder publishes happen at step 10.
3. **Create the repository.** `git init` here, first commit with
   `LICENSE`, `README.md`, `.gitignore`; create `angiehemans/scampjs`
   on GitHub and push.
4. **Scaffold the workspace.** Root `package.json`, `tsconfig.base.json`,
   both packages with their `package.json` and `exports` maps, an empty
   `src/index.ts` each. `npm ci`, `tsc`, and `npm publish --dry-run`
   pass on the empty packages.
5. **CI green on empty.** Both workflows, one push, one tag.
6. **Runtime types and their tests.**
7. **Fixtures.** Write `fixtures/contract-0/` by hand, following the
   worked example in the framework plan exactly, including the `_scamp`
   export.
8. **`CONTRACT.md`.** All four sections, quoting the fixtures, with the
   drift test.
9. **`README.md`, `CLAUDE.md`, `docs/notes/README.md`.**
10. **Tag `scampjs@0.0.1`** and, if Decision 2 is yes, publish both
    packages.
11. **App repo follow-up** (below).

Steps 4 through 9 are a few days of work. Step 2 is the only one that
needs you at a keyboard, and it gates step 10, not the rest.

## Tasks in the app repo

Phase 0 changes nothing in the app's code. It does touch its docs:

- Replace `@scamp/framework`, `scamp/runtime`, `npm create scamp`, and
  `create-scamp` with the chosen names in
  `docs/plans/scamp-framework-plan.md`,
  `docs/plans/scamp-framework-tech-plan.md`, and
  `docs/website/scamp-framework.md`.
- Add one line to those plans pointing at this repository and
  `CONTRACT.md` as the contract's home.
- Phase 1's `agent.md` template will import types from
  `scampjs/runtime`; nothing to do until phase 1.

## Not in phase 0

No Vite, Preact, or Hono dependency. No `scamp dev`. No templates
implementation. No docs site. No adapters. No changes to the app's
code. If any of these seems necessary to finish the contract, that is
a sign the contract is describing behaviour instead of shape.

## Done when

- The `@scampjs` org exists and the names in Decision 1 are held.
- `angiehemans/scampjs` is public, MIT, with CI green on `main`.
- `npm publish --dry-run --workspaces` succeeds for both packages.
- `scampjs/runtime` exports the five types above with passing type
  tests, and `scampjs` exports `CONTRACT_VERSION` equal to the
  `scampjs.contract` key in its `package.json`.
- `CONTRACT.md` covers all four sections, every fenced example is
  backed by a fixture file, and the drift test proves it.
- `fixtures/contract-0/views/Lobby/Lobby.tsx` exists in the exact form
  phase 1's generator will be tested against.
- The app repo's two plans and website copy use the chosen names.

## Progress

Updated 2026-09-10.

| Task                        | State                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Decisions 1 through 8    | Done. All recommendations accepted.                                                                                                                 |
| 2. Claim names              | **Needs you.** `npm login`, then create the `@scampjs` org at npmjs.com.                                                                            |
| 3. Repository               | Done. `angiehemans/scampjs`, public, MIT, `main` pushed.                                                                                            |
| 4. Workspace scaffold       | Done. `npm run check` passes: lint, format, typecheck, test, build, dry-run publish.                                                                |
| 5. CI green on empty        | Done. `ci.yml` runs on push and PR; `release.yml` on `<package>@<version>` tags.                                                                    |
| 6. Runtime types and tests  | Done. `scampjs/runtime` exports `Env`, `Params`, `LoadContext`, `RouteProps`, `RenderMode`, `ViewMeta`; `scampjs` exports `CONTRACT_VERSION`.       |
| 7. Fixtures                 | Done. `packages/framework/fixtures/contract-0/`, with all five binding kinds in `Lobby`.                                                            |
| 8. `CONTRACT.md`            | Done. Four sections plus the fixture index; 15 fixture-backed quotes checked by the drift test.                                                     |
| 9. README, CLAUDE.md, notes | Done.                                                                                                                                               |
| 10. Tag and publish         | Tags `scampjs@0.0.1` and `create-scampjs@0.0.1` pushed; the workflow dry-runs. **Publishing needs you:** after `npm login`, run the commands below. |
| 11. App repo follow-up      | Edited, not committed: the two plans and the website copy use the new names and point here. Review the diff in the app repo and commit.             |

Publishing, once logged in, from the repository root:

```bash
npm run build
npm publish -w scampjs --access public
npm publish -w create-scampjs --access public
```

After the first publish, enable trusted publishing for both packages on
npmjs.com (package settings, "Trusted publisher", GitHub Actions,
repository `angiehemans/scampjs`, workflow `release.yml`) and phase 2
can drop `--dry-run` from the release workflow.

Two things the build surfaced that the contract now states:

- **Slot props type as `React.ReactNode`.** The app's generator emits
  that today. Under Preact it resolves through the `react` to
  `preact/compat` mapping in the project's `tsconfig.json`, so the
  contract specifies that mapping in section 1.8 and the fixture
  carries it. Phase 2's template must include it.
- **The `_scamp` export lists events in props-type order**, and the
  drift test checks that the list equals the function-typed members of
  the props type. Phase 1's generator gets the same rule for free.
