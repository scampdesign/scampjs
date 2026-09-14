# Phase 6 — API routes, the Drizzle recipe, the Cloudflare adapter — Plan

Status: **in progress (2026-09-14).** Source: "Phase 6" of
`scamp/docs/plans/scamp-framework-tech-plan.md`; the design is "The
server layer" and "The data layer" in `scamp-framework-plan.md`.
Produces **contract 2**.

## Goal

A project with a database-backed `load()` and a plain `POST` handler
deploys to Cloudflare from `scamp build`, and the same project runs
locally on SQLite with no code change.

## Decisions

| Decision                   | Choice                                                                                                                                 | Why                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| API route shapes           | Named `GET`/`POST`/… handlers over `LoadContext` returning a `Response`; or a default-exported Hono app mounted at the file's path     | The plan's two shapes. Plain is the default; the Hono export is the opt-in for middleware and in-file routing.        |
| Where the server app lives | `scampjs/server`: one `createServerApp()` used by the built worker; the dev server shares its request handling                         | One implementation of matching, `load()`, rendering, and API dispatch, so dev and production cannot drift.            |
| Adapter selection          | `"scamp": { "adapter": "@scampjs/adapter-cloudflare" }` in `package.json`                                                              | Declarative, readable by the app for its UI later, no config file the app would have to ignore.                       |
| Adapter interface          | `{ name, build(ctx) }` from `scampjs/adapter`; the core hands it the bundled server entry, the static folder, and the route table      | Each adapter is a thin layout step; Hono runs everywhere already.                                                     |
| With an adapter            | `server` routes and dynamic routes without `params()` render per request; static routes still prerender to files the host serves first | The static folder stays the fast path; the worker answers what a folder cannot.                                       |
| Cloudflare target          | Workers with static assets: `dist/_worker.js` plus `dist/` as the assets directory, and a `wrangler.jsonc` written once                | One bundle serves both Workers and Pages (advanced mode uses the same `_worker.js`). Proved under Miniflare in tests. |
| `env`                      | Cloudflare bindings are `env` as is; the dev server keeps `process.env` plus `.dev.vars`                                               | The contract's `LoadContext.env`, filled by the adapter.                                                              |
| Recipe                     | `scamp add drizzle --dialect sqlite\|postgres\|d1`, from `scampjs/templates`; `create-scampjs` asks the database question              | One source for the files, the same as the project template.                                                           |
| D1 locally                 | `lib/db.ts` uses `env.DB` when the binding exists and a libsql file otherwise                                                          | "The same project runs locally on SQLite with no code change."                                                        |

## Slices

1. API routes in the dev server: `routes/api/**`, both shapes, 405 and 404, the contract-2 fixture.
2. `scampjs/server` and the adapter hook in `scamp build`: the server bundle, `decide()` with an adapter, the adapter contract.
3. The Drizzle recipe, `scamp add`, and the scaffolder's database question.
4. `@scampjs/adapter-cloudflare`, proved under Miniflare with a D1-backed `load()` and a `POST` handler.
5. Contract 2, reference docs, versions, publish.

## Done when

- [ ] `scamp dev` serves plain and Hono API routes from `routes/api/`.
- [ ] `scamp build` with the Cloudflare adapter emits `dist/_worker.js` and `wrangler.jsonc`, and the worker serves a server route, an API route, and a D1 `load()` under Miniflare.
- [ ] The same project runs on `scamp dev` against SQLite with no code change.
- [ ] `scamp add drizzle` and `npm create scampjs --db` write the recipe.
- [ ] `scampjs` 0.3.0, `create-scampjs` 0.2.0, `@scampjs/adapter-cloudflare` 0.1.0 published; contract 2.
