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

**Contract 1: create, run, build, deploy.** `npm create scampjs`
scaffolds a project; `scamp dev` serves its routes with `load()` and
renders every view at `/_views/<Name>`; `scamp build` prerenders it into
a folder any static host serves, with no JavaScript on a route whose
views declare no events; `scamp preview` serves that folder. Server
rendering per request and `scamp add` arrive with the first adapter.
See `docs/reference/` for routing, `load()`, rendering modes, and the
files, and `docs/plans/` for the phases.

## Packages

| Package                                     | What                                                                                                | Version |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------- |
| [`scampjs`](packages/framework)             | The framework: `scamp dev`, `scamp build`, `scamp preview`, `scampjs/runtime`, `scampjs/templates`. | 0.2.0   |
| [`create-scampjs`](packages/create-scampjs) | `npm create scampjs`: scaffolds a project from the framework's templates.                           | 0.1.0   |
| `@scampjs/adapter-*`                        | Deploy adapters, one package each, from phase 6.                                                    | —       |

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
npm run check      # lint, format, typecheck, build, test, pack dry-run
```

`npm test` builds first: the CLI test runs the built binary. To try the
dev server by hand, `cd packages/framework/fixtures/contract-0 && node
../../bin/scamp.js dev`, then open the printed URL or `/_views/Lobby`.

Releases are tagged `<package>@<version>` and published by CI.

## License

MIT.
