import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  Env,
  LoadContext,
  Params,
  RenderMode,
  RouteProps,
  ViewMeta,
} from '../src/runtime/index.js';

// The augmentation a project writes in scamp-env.d.ts. Relative module
// augmentation is allowed, and it is what makes `env.DB` typed below.
declare module '../src/runtime/index.js' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Env {
    DB: { query: (sql: string) => Promise<unknown[]> };
  }
}

async function load({ params, env }: LoadContext<{ token: string }>): Promise<{
  token: string;
  rows: unknown[];
}> {
  const rows = await env.DB.query(`select ${params.token}`);
  return { token: params.token, rows };
}

describe('scampjs/runtime types', () => {
  it('LoadContext narrows params and exposes request and env', () => {
    expectTypeOf<LoadContext<{ token: string }>['params']>().toEqualTypeOf<{
      token: string;
    }>();
    expectTypeOf<LoadContext['params']>().toEqualTypeOf<Params>();
    expectTypeOf<LoadContext['request']>().toEqualTypeOf<Request>();
    expectTypeOf<LoadContext['env']>().toEqualTypeOf<Env>();
  });

  it('Env accepts declaration merging', () => {
    expectTypeOf<Env['DB']['query']>().returns.resolves.toEqualTypeOf<
      unknown[]
    >();
  });

  it('RouteProps<typeof load> resolves data to the awaited return', () => {
    expect(typeof load).toBe('function');
    expectTypeOf<RouteProps<typeof load>['data']>().toEqualTypeOf<{
      token: string;
      rows: unknown[];
    }>();
    expectTypeOf<RouteProps<typeof load>['params']>().toEqualTypeOf<Params>();
  });

  it('RouteProps without load has undefined data', () => {
    expectTypeOf<RouteProps['data']>().toEqualTypeOf<undefined>();
  });

  it('RenderMode is the three modes', () => {
    expectTypeOf<RenderMode>().toEqualTypeOf<'static' | 'server' | 'client'>();
  });

  it('ViewMeta is what a view exports as _scamp', () => {
    const meta = { contract: 0, events: ['onCopy', 'onStart'] } as const;
    expectTypeOf(meta).toMatchTypeOf<ViewMeta>();
  });
});
