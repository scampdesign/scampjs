# Routing

A route is a file under `routes/`. Its path is its URL.

| File                             | URL                                  |
| -------------------------------- | ------------------------------------ |
| `routes/index.tsx`               | `/`                                  |
| `routes/about.tsx`               | `/about`                             |
| `routes/about/index.tsx`         | `/about`                             |
| `routes/game/[token]/lobby.tsx`  | `/game/:token/lobby`                 |
| `routes/docs/[...slug].tsx`      | `/docs/*` (one or more segments)     |
| `routes/(marketing)/pricing.tsx` | `/pricing` (a group adds no segment) |

Static segments win over `[param]`, which wins over `[...rest]`, position
by position. `routes/api/` is reserved for API handlers, which arrive
with a later release; requests there are 404 today.

A route file exports a component, and optionally `load`, `render`, and
`params`:

```tsx
import type { LoadContext, RouteProps } from 'scampjs/runtime';
import Lobby from '@/views/Lobby/Lobby';

export const render = 'static';

export function params() {
  return [{ token: 'KZQ4' }];
}

export async function load({ params, request, env }: LoadContext<{ token: string }>) {
  return { code: params.token };
}

export default function LobbyRoute({ params, data }: RouteProps<typeof load>) {
  return <Lobby code={data.code} />;
}
```

`useParams()` from `scampjs/runtime` returns the matched params inside
any component the route renders. `Link` is an anchor and `navigate()`
is a full navigation; there is no client-side router.
