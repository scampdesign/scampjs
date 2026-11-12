import { describe, expect, it } from 'vitest';
import { routeModuleShape } from '../src/server/render.js';

const Page = (): null => null;

describe('a route file title export', () => {
  it('is read as a string or a function, and is null when absent', () => {
    expect(routeModuleShape({ default: Page, title: 'Home' }, 'r').title).toBe(
      'Home',
    );
    const fn = (): string => 'Lobby';
    expect(routeModuleShape({ default: Page, title: fn }, 'r').title).toBe(fn);
    expect(routeModuleShape({ default: Page }, 'r').title).toBeNull();
  });

  it('refuses anything else, naming the file', () => {
    expect(() =>
      routeModuleShape({ default: Page, title: 3 }, 'routes/a.tsx'),
    ).toThrow('routes/a.tsx: title must be a string');
  });
});
