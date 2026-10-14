# SVG attributes written the React way

Status: built 2026-10-14; release and the riq-frontend bump are left.

## The bug

An icon Scamp draws with `strokeWidth="2"` is thicker on the Scamp canvas
than in a scampjs page. Measured on riq-frontend's
`/appointment-patient-details`: every view icon renders with a **1px**
stroke in the page and 2px on the canvas.

Scamp writes SVG attributes the React way — `strokeWidth`,
`strokeLinecap`, `strokeLinejoin`, `fillRule`, `clipRule`, and so on —
because the canvas renders with React, which maps them to `stroke-width`
and friends. A scampjs page compiles JSX against core Preact
(`jsxImportSource: 'preact'`), which doesn't. So:

1. The server writes `<svg strokeWidth="2">`.
2. The HTML parser lowercases it to `strokewidth`, which SVG ignores.
3. The browser falls back to the default stroke width, 1.
4. Hydration doesn't add the attribute either.

Components that look right (riq-frontend's `Sidebar`, `Field`) only do
because their CSS sets `stroke-width: 2px` as well.

Confirmed with the workspace's own renderer:

```
core   : <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" …>
compat : <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" …>
```

`preact/compat` normalizes these names in its `options.vnode` hook, which
runs when a vnode is created — so it applies on the server and in the
browser alike, as long as the module has been loaded. Today it loads only
when something imports `react` (the alias in `dev/vitePlugin.ts`), and
Scamp's views don't.

## The fix

Load `preact/compat` for its side effect wherever pages render. Two
places cover every path:

- [x] **Server — `packages/framework/src/server/render.ts`.** Add
      `import 'preact/compat';` at the top, with a one-line comment saying
      why. `dev/render.ts` imports from this module, the built server
      (`server/app.ts`) does too, and the Cloudflare adapter runs the built
      server, so one import covers dev, build, and the adapter.
- [x] **Browser — `entryCode` in `packages/framework/src/dev/vitePlugin.ts`.**
      Add `import 'preact/compat';` as the first line of the `hydrate` entry
      (not the `css` one). The production build gets its entries from the
      same function (`build/build.ts` imports `entryId`), so this covers
      both. Without it, the first client re-render after hydration would
      write the camelCase names back.

`preact/compat` is already a dependency (it's Preact's own entry point),
so nothing new is installed. It adds a few KB to pages that hydrate;
pages that ship no JavaScript are unaffected.

**Alternative, if that size matters:** a ~20-line `options.vnode` hook in
the runtime that maps only SVG camelCase attributes to kebab-case. More
code to own, and it would drift from what `preact/compat` and React do,
so it's the second choice.

## Tests

In `packages/framework/test/`:

- [x] **Server render.** Render a route whose component returns
      `<svg strokeWidth="2" strokeLinecap="round" fillRule="evenodd">` through
      `renderPage` and assert the HTML contains `stroke-width="2"`,
      `stroke-linecap="round"`, and `fill-rule="evenodd"`, and not
      `strokeWidth`. Check it fails before the import is added.
- [x] **Client entry.** Assert the `hydrate` entry code starts by
      importing `preact/compat`, and the `css` entry doesn't.
- [x] Run the existing suite: `contract-drift`, `dev-server`, `build`,
      and the adapter tests.

## Contract

- [x] Add a line to `CONTRACT.md` (and the framework's copy): SVG
      attributes may be written in React's camelCase form, and render as
      their SVG names. Scamp relies on it; it's worth stating rather than
      leaving as a property of whichever renderer is loaded.

## What was built

The two imports, as planned. The tests went in `dev-server.test.ts`
instead of a standalone `renderPage` test: `/` and `/_views/Home` render
the fixture's icon with `stroke-width` and `stroke-linecap`, and the
hydrate entry loads `preact/compat`. Both fail without the imports. The
fixture's Home view (contract-0, mirrored in contract-2) gained the icon,
generated through Scamp's own `parseCode`/`generateCode` so it is the
exact shape Scamp writes; Scamp's `contract0Drift` test passes against it.
The client-entry check is in the lobby test, since that's the route that
hydrates. See `docs/notes/svg-attribute-names.md`.

## Release and verify

- [ ] Changelog entry, version bump (patch: `0.3.1`), release the
      workspace the usual way. The repo has one unpushed commit (`4196dbf`,
      the guides) — push or release it with this.
- [ ] In riq-frontend, bump `scampjs` to the new version and reinstall.
- [ ] Restart the dev server, open
      `http://localhost:33117/appointment-patient-details`, and check an
      icon: its `<svg>` should carry `stroke-width="2"`, and its paths should
      compute `stroke-width: 2px` (they were `1px`). A quick check from the
      Scamp repo, which has Playwright:

  ```js
  // zz-measure.mjs — run with `node zz-measure.mjs` from ~/Documents/github/scamp
  import { chromium } from 'playwright';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:33117/appointment-patient-details', { waitUntil: 'networkidle' });
  console.log(await page.evaluate(() => {
    const svg = document.querySelector('svg[data-scamp-id="fact_date_icon_64e9"]');
    return { attr: svg?.getAttribute('stroke-width'), computed: getComputedStyle(svg.querySelector('path')).strokeWidth };
  }));
  await browser.close();
  ```

  Expected: `{ attr: '2', computed: '2px' }`.

## Not in scope

- Scamp itself: the canvas is already right, and Scamp should keep
  writing React-style names, which are what agents and React users write.
- The redundant `stroke-width: 2px` in riq-frontend's component CSS. It
  stays harmless once the attribute renders.
