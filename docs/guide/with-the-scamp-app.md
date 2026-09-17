# With the Scamp app

The framework runs without [Scamp](https://www.scamp.club), and Scamp
opens a project without the framework installed. This page is about
what happens when you use both, which is the case the two were designed
around: a designer draws the pages, and a developer or an agent writes
what feeds them.

## Who owns what

| Path                                  | Scamp                                            | You                                  |
| ------------------------------------- | ------------------------------------------------ | ------------------------------------ |
| `views/<Name>/`                       | Writes and rewrites both files                   | Read them; edit them if you'd rather |
| `components/<Name>/`                  | Same                                             | Same                                 |
| `design/theme.css`                    | Edits through the Design System panel            | Edit it directly                     |
| `routes/**`                           | Lists them, sets one export, generates a starter | Everything else                      |
| `.dev.vars`, `lib/`, `db/`, `public/` | Never touched                                    | Yours                                |
| `agent.md`                            | Regenerates on open, keeping recipe sections     | Read it                              |
| `.scamp/`, `scamp.config.json`        | Owns                                             | Ignore them                          |

The line is the same one the framework draws between a view and a
route. Scamp owns what a page looks like. You own what it knows.

## Designing against real shapes

A view's props type is the contract a `load()` has to satisfy, and
Scamp writes that type from what the designer marks in the **Data**
section: a text prop, a repeat over a list, a show flag, a bound
attribute, an event handler. Each one carries its sample, which is both
what the canvas renders and what the file defaults to.

So by the time anyone writes a route, the shape already exists:

```tsx
type LobbyProps = {
  code?: string;
  players?: Array<{ id: string; label: string; status: string }>;
  waiting?: boolean;
  onStart?: () => void;
  className?: string;
};
```

**Generate route** in the app writes `routes/lobby.tsx` with a `load()`
that returns those samples, typed. Replacing the samples with a real
query is then the whole job, and the design never has to change for it.

## Previewing

Scamp's **Preview** runs `scamp dev` and opens a window on it. A view
that a static route renders opens at that route, so its `load()` runs.
A view with no route yet opens at `/_views/<Name>` with its defaults,
which is how a design is visible before any data exists.

The first preview runs `npm install` if the project has no
`node_modules`, so a fresh clone needs no separate step. The dev
server's request log appears in Scamp's app log.

## Versions

`scampjs` publishes a contract number, an integer that changes only
when a file shape changes. A build of Scamp reads and writes a range of
them. Opening a project, Scamp compares the two:

- **In range.** Nothing to see.
- **Out of range.** A notice in the properties panel names the
  contract and asks you to update Scamp or install a matching
  `scampjs`. The canvas still opens, but a save would write a shape the
  installed framework doesn't understand.
- **Not installed.** Nothing to see. Designing needs no framework, and
  the first preview installs it.

A file keeps the contract version it declares. New files get the
newest one Scamp writes.

## If you don't use Scamp

Nothing here is required. Views are JSX functions and CSS modules;
write them by hand and the framework neither knows nor cares. Two
conventions are worth keeping even so, because they cost nothing:

- **`data-scamp-id` on each element**, matching its class name. This is
  how Scamp maps an element on the canvas to a line in the file, so
  keeping it means someone can open the project in Scamp later.
- **The `_scamp` export.** The build reads its `events` to decide
  whether a page ships JavaScript. Without it, the page ships
  JavaScript to be safe.

## If you don't use the framework

Also fine. A view imports nothing from `scampjs`, so
`views/` and `components/` drop into a Next, Remix, or Vite project
with an `@/` alias and `react` mapped to `preact/compat`, or with React
itself. You lose `scamp dev`, the routing, and the build; you keep
every file Scamp wrote.

That is the portability promise, and it is why the view file shape is
as plain as it is.
