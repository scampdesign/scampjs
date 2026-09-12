# scampjs

The Scamp framework: a page's **structure**, **styles**, and **logic** in
three files with one owner each, running on Vite, Preact, and Hono.
Views are plain JSX functions whose defaults are their sample data.
Routes are yours and are never generated. Rendering mode is chosen per
route, and islands come from the data instead of from you.

It is the framework the [Scamp](https://www.scamp.club)
design tool writes projects for, and it works without Scamp installed.
The files are the product: views and components drop into a Next,
Remix, or Vite project unchanged.

## Status

**Contract 0: nothing runs yet.** This repository holds the contract
between the framework and the Scamp app, the runtime types, and a
fixture project in the specified shape. `scamp dev` arrives with
contract 1. See `docs/plans/phase-0-bootstrap-plan.md` for what this
phase is and the plans in the Scamp app repository for the whole road.

## Packages

| Package                                     | What                                                                                      | Version |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- | ------- |
| [`scampjs`](packages/framework)             | The framework. `scampjs/runtime` types now; `scamp dev`, `build`, `preview`, `add` later. | 0.0.5   |
| [`create-scampjs`](packages/create-scampjs) | `npm create scampjs`. A stub that points here until phase 4.                              | 0.0.2   |
| `@scampjs/adapter-*`                        | Deploy adapters, one package each, from phase 6.                                          | —       |

## The contract

[`CONTRACT.md`](CONTRACT.md) is the one document both this repository
and the Scamp app implement against: the file layout, the view file
shape, the five-kind binding grammar, the `_scamp` metadata, the route
file, the CLI, and the templates export. It is versioned by an integer
that bumps only when a shape changes. `fixtures/contract-0/` is a
complete project in that shape, and a test proves every quoted example
in the contract matches it.

## Working on it

```bash
nvm use            # Node 24
npm ci
npm run check      # lint, format, typecheck, test, build, pack dry-run
```

Releases are tagged `<package>@<version>` and published by CI.

## License

MIT.
