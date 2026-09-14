# Rendering modes

One export per route, default `static`:

```ts
export const render = 'static'; // prerender at build; ship HTML and CSS
export const render = 'server'; // render per request through an adapter
export const render = 'client'; // prerender, then run in the browser
```

## What ships

A route ships JavaScript only when it renders in the browser (`client`)
or when a view it renders declares event props in its `_scamp` export.
A static route whose views declare none ships HTML and one stylesheet.
When JavaScript ships, the page carries its `params` and `data` as JSON
and the route hydrates from them.

## Under `scamp build`

The build prerenders into `dist/`, a folder any static host serves.

| Route                                           | Result                                          |
| ----------------------------------------------- | ----------------------------------------------- |
| `static`, no dynamic segments                   | One page, `load()` run at build time            |
| `static`, dynamic segments, `params()` exported | One page per entry                              |
| `static`, dynamic segments, no `params()`       | Refused: add `params()` or use a server adapter |
| `client`                                        | As `static`, and the page hydrates              |
| `server`                                        | Refused until a server adapter exists           |

`scamp preview` serves `dist/` as a static host would. `scamp dev`
renders every route per request, with `client` routes hydrating in the
browser.
