# Phase 4 — `scamp build`, rendering modes, `create-scampjs` — Plan

Status: **implemented on 2026-09-14; publish pending** (`scampjs@0.2.0`,
then `create-scampjs@0.1.0`, which depends on it). Source: "Phase 4" of
`scamp/docs/plans/scamp-framework-tech-plan.md`.

## Goal

Someone with no Scamp installed can create, build, and deploy a
project: `npm create scampjs && npm run build` produces a folder any
static host serves, with zero JavaScript on a route without events.

## Decisions

| Decision                          | Choice                                                    | Why                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Island granularity                | The route                                                 | Handlers live in the route file; a view alone has nothing to call. The metadata decides whether a route ships JavaScript at all.     |
| `load()` in the browser           | Tree-shaken by importing only the default export          | No parser, no transform; the bundler already does it. Side-effectful server modules are the documented exception.                    |
| `client` under the static adapter | Prerendered and hydrated, like a static route with events | A client route with `load()` and dynamic params has nothing to run `load()`, so it is refused with the same message as a static one. |
| `server` mode                     | Refused with a message until an adapter exists            | The plan gates it on phase 6.                                                                                                        |
| Output                            | `dist/<path>/index.html` plus `dist/assets/`              | Clean URLs on every static host. `public/` copies over.                                                                              |
| Route facts                       | Read from the built module's exports                      | Exact, and the same code path the dev server uses.                                                                                   |
| Views under a route               | From the SSR bundle's chunk modules                       | Follows real imports, shared chunks included, without a second parser.                                                               |
| `scamp preview`                   | A plain file server, no fallbacks                         | Matches a static host; a page that needs a rewrite would fail here first.                                                            |
| `create-scampjs`                  | Depends on `scampjs` and calls `projectTemplate`          | One source for the files; the app's scaffold calls the same function.                                                                |
| Database question                 | Asked, `none` only                                        | Wired for phase 6's recipe.                                                                                                          |
| Docs                              | Reference pages in `docs/reference/`                      | A site is hosting, not content; the pages are the content.                                                                           |

## What landed

- `src/build/plan.ts`: the decisions, pure and tested.
- `src/build/build.ts`: the two builds and the prerender.
- `src/build/preview.ts`: the static server.
- `src/dev/vitePlugin.ts`: entry modes (`hydrate`, `css`) and the theme import for built entries.
- `src/dev/shell.ts`: stylesheet links.
- `src/cli/`: `scamp build`, `scamp preview [--port]`.
- `packages/create-scampjs`: the scaffolder, `--name`, `--db`, `--yes`.
- CONTRACT.md 2.3 and 2.4; `docs/notes/build.md`; `docs/reference/`.

## Done when

- [x] A scaffolded project builds; `/` ships no JavaScript; a static route with an event view hydrates; a client route hydrates; `params()` pages render; `public/` copies.
- [x] `load()` and its imports are absent from the browser bundle.
- [x] Server routes and un-enumerated dynamic routes are refused with the fix named, and nothing is written.
- [x] `scamp preview` serves the folder as a host would.
- [x] `create-scampjs` scaffolds unattended and interactively.
- [ ] `scampjs@0.2.0` and `create-scampjs@0.1.0` published.

## Left for later

- Per-view islands, if the contract ever moves handlers into views.
- Client-side routing behind `Link`: not planned.
- The framework template's theme should carry `body { margin: 0; min-height: 100vh }` (noted by the app's phase 3); done in this phase's template change.
