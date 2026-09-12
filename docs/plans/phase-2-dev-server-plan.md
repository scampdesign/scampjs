# Phase 2 — `scamp dev` — Plan

Status: **implemented on 2026-09-12; publish pending.** Source: "Phase
2" of `scamp/docs/plans/scamp-framework-tech-plan.md`. Produces
contract 1.

## Goal

A dev server that runs a phase-1 project and is a drop-in preview
target for the Scamp app: routes with `load()`, `/_views/<Name>` for
every view, the readiness line the app's detector matches, and the
templates export so the app and `create-scampjs` scaffold the same
files.

## Decisions

| Decision           | Choice                                                                                           | Why                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite version       | 8 (rolldown)                                                                                     | Current; the engine floor is unchanged. JSX is configured through `oxc.jsx` with Preact's automatic runtime; no `@preact/preset-vite`, which would bring Babel for prefresh. |
| Server composition | One `http.Server`; Vite middleware first, then a Hono app                                        | One port for the app to open; Hono is real, not decorative: it is what adapters mount later.                                                                                 |
| Route loading      | `vite.ssrLoadModule`                                                                             | Still supported in Vite 8; the environment API can replace it later without touching the contract.                                                                           |
| Styles             | Inlined from the SSR module graph, theme first                                                   | A page without JavaScript has no Vite client to inject them; the app's parity harness wants one document.                                                                    |
| HMR                | Full reload on any project change                                                                | Rendered pages are SSR-only; correct and small. Finer HMR waits for islands.                                                                                                 |
| Hydration          | `client` routes hydrate as a whole; `static`/`server` ship no JS                                 | Islands from `_scamp.events` are phase 4's build work; dev follows the build once it exists.                                                                                 |
| `useParams`        | Symbol-keyed global set around a synchronous render                                              | Three module instances of the runtime exist (renderer, Vite's runner, the browser); a context would not cross them.                                                          |
| `env`              | `process.env` overlaid with `.dev.vars`                                                          | Cloudflare's local-secrets convention; one file for projects that deploy there.                                                                                              |
| Routes table       | Scanned on demand, invalidated when a file under `routes/` is added or removed                   | Cheap, and always current.                                                                                                                                                   |
| `routes/api/**`    | Not routed                                                                                       | Reserved for contract 2; a request there is 404.                                                                                                                             |
| Runtime helpers    | `Link` is an anchor, `navigate` is `location.assign`, no client router                           | The contract promises the names; a router is not in the size budget and nothing needs it yet.                                                                                |
| Tests              | Vitest in-process on the fixture and a scaffolded project; the CLI spawned from the built binary | Proves the "done when" line without a browser. `pretest` builds.                                                                                                             |

## What landed

- `src/dev/routes.ts`: file to pattern, specificity order, matching.
- `src/dev/env.ts`: `.dev.vars` and `readEnv`.
- `src/dev/shell.ts`: the document shell.
- `src/dev/render.ts`: `renderRoute`, `renderView`, CSS collection,
  the contract check on `_scamp`.
- `src/dev/vitePlugin.ts`: aliases, JSX, the virtual hydration entry.
- `src/dev/server.ts`: `createDevServer`.
- `src/dev/log.ts`: `--json` and human logs.
- `src/cli/`: `scamp dev [--port] [--json]`; `build`, `preview`, `add`
  exit 1 with a message; `bin/scamp.js`.
- `src/runtime/`: `useParams`, `Link`, `navigate` beside the types.
- `src/templates/`: `projectTemplate`, `viewTemplate`,
  `componentTemplate`, with the theme ported from the app.
- CONTRACT.md at version 1: the runtime exports table, what dev does
  with a route, the templates export as implemented.
- `docs/notes/dev-server.md`.

## Done when

- [x] The contract-0 fixture runs: `/` and `/game/KZQ4/lobby` render,
      `/_views/` lists `Home` and `Lobby`, `/_views/Lobby` renders with
      inlined styles.
- [x] A project scaffolded from the templates runs, and its `load()`
      reads `env` from `.dev.vars`.
- [x] The binary prints exactly `scamp dev ready http://127.0.0.1:<port>`
      first on stdout, logs JSON per request with `--json`, and exits 0
      on SIGINT.
- [ ] `scampjs@0.1.0` published with `scampjs.contract: 1` (tag
      `scampjs@0.1.0`; CI publishes).

## Deferred, and where it goes

- Stripping `load()` from a `client` route's browser bundle: phase 4,
  with the build's own transform; dev reuses it.
- Islands and CSS HMR on rendered pages: phase 4.
- A client router behind `Link`: not planned; a full navigation is the
  contract.
- `create-scampjs` calling `projectTemplate`: phase 4, with `scamp
build`, so the first `npm create scampjs` project can also build.
