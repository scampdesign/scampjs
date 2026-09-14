# Files

A page is three files with one owner each:

```
views/<Name>/<Name>.tsx          the structure — the Scamp app owns it
views/<Name>/<Name>.module.css   the styles    — the Scamp app owns it
routes/**                        the logic     — yours, never generated
```

Plus `components/<Name>/`, in the same shape as a view, and
`design/theme.css`, the tokens the app edits and the framework injects
first into every page.

A view is a plain function with a props type whose defaults are its
sample data, a `className` passthrough, and a `_scamp` export naming
its event props. It imports nothing from `scampjs` and renders unchanged
in any React or Preact project.

The exact shapes, with a complete fixture project and the test that
keeps them in step, are in [CONTRACT.md](../../CONTRACT.md).

## Scaffolding

```bash
npm create scampjs my-app
cd my-app
npm install
npm run dev
```

`create-scampjs` writes the same files the Scamp app writes for a new
project, from `scampjs/templates`.
