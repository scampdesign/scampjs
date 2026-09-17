# scampjs docs

## Guide

- [Getting started](guide/getting-started.md) — create a project, run
  it, build it, deploy it
- [With the Scamp app](guide/with-the-scamp-app.md) — who owns which
  files, and what changes when you design in Scamp

## Reference

- [Files](reference/files.md) — what a page is made of
- [Routing](reference/routing.md) — `routes/`, segments, and a route's exports
- [`load()`](reference/load.md) — data, `env`, and where computation belongs
- [Rendering modes](reference/rendering-modes.md) — `static`, `server`, `client`, and what ships
- [API routes](reference/api-routes.md) — handlers under `routes/api/`
- [Database](reference/database.md) — the Drizzle recipe
- [Deploy to Cloudflare](reference/deploy-cloudflare.md) — Workers and Pages

## The contract

[CONTRACT.md](../CONTRACT.md) is the exact file, CLI, and template
shapes, versioned by an integer. Both this repository and the Scamp app
implement against it, and a fixture project plus a drift test keep the
document honest.

## Internals

[`notes/`](notes/README.md) explains how the dev server, the build, and
the server are put together. [`plans/`](plans/) is one plan per phase of
the work, kept as a record of what was decided and why.
