# CLAUDE.md — scampjs

Read on every session. Follow everything here without being asked.

## What this is

The Scamp framework, published to npm as `scampjs` and `create-scampjs`,
with `@scampjs/adapter-*` later. Companion to the Scamp Electron app
(`../scamp`), which writes projects in this framework's shape. The
reasoning lives in the app repo's `docs/plans/scamp-framework-plan.md`
and `scamp-framework-tech-plan.md`; the contract between the two repos
lives here in `CONTRACT.md`.

## Non-negotiable rules

- **The size target is a review criterion.** The framework is
  conventions plus tooling on Vite and Hono, small enough to read in an
  afternoon. Anything that grows past that becomes an adapter to an
  existing thing, not code here.
- **No Electron, no React, no imports from the app repo. Ever.**
- **Route files never see Hono.** `load()` and API handlers receive a
  `LoadContext` and return standard types. Exporting a Hono app from an
  API file is the opt-in, never the default.
- **`CONTRACT.md` changes ship with the fixture and the test in the same
  commit.** A shape change bumps `scampjs.contract` in
  `packages/framework/package.json` and `CONTRACT_VERSION`; an addition
  does not. The drift test in `packages/framework/test/` must pass.
- **Never write `any`.** Use `unknown` with a type guard.
- **`type` over `interface`**, except for declaration merging (`Env`).
- **Explicit return types** on every exported function.
- **Fixtures are a user project.** `packages/framework/fixtures/` is
  written by hand in the exact shape the Scamp app's generator emits.
  Match its conventions (double-quoted string defaults and attributes,
  single-quoted imports, one `data-scamp-id` per element, `_scamp`
  export last). Do not lint or format it with this repo's tools.

## Layout

```
packages/framework/        npm: scampjs      (src/, test/, fixtures/)
packages/create-scampjs/   npm: create-scampjs
scripts/prepack.mjs        copies CONTRACT.md + LICENSE into a package on pack
docs/plans/                one plan per phase; docs/notes/ for context that outgrows a comment
```

## Commands

`npm run check` runs everything CI runs. Individually: `lint`,
`format:check`, `typecheck`, `test`, `build`, `pack:dry`.

## Comments and notes

Short inline comments for local why only. Anything longer, or anything
spanning files, goes in `docs/notes/<slug>.md` and is referenced inline.
Update the note in the same commit as the code it describes.
