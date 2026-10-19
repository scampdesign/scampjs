import { describe, expect, it } from 'vitest';
import {
  declaresInteractions,
  nextValue,
  parseInteractions,
} from '../src/runtime/interactions.js';

/** CONTRACT.md §1.3.2: click, outside, and Escape interactions. */

describe('parseInteractions', () => {
  it('reads each axis group and its transitions', () => {
    expect(parseInteractions('state:closed=open,open=closed')).toEqual([
      {
        axis: 'state',
        transitions: [
          { from: 'closed', to: 'open' },
          { from: 'open', to: 'closed' },
        ],
      },
    ]);
  });

  it('reads several groups, and * as any value', () => {
    expect(parseInteractions('state:*=closed  tab:one=two')).toEqual([
      { axis: 'state', transitions: [{ from: null, to: 'closed' }] },
      { axis: 'tab', transitions: [{ from: 'one', to: 'two' }] },
    ]);
  });

  it('skips what is malformed rather than throwing', () => {
    expect(parseInteractions('')).toEqual([]);
    expect(parseInteractions('state')).toEqual([]);
    expect(parseInteractions('State:a=b')).toEqual([]);
    expect(parseInteractions('state:a=b=c,Open=x,a=')).toEqual([]);
    expect(parseInteractions('state:a=b,bad')).toEqual([
      { axis: 'state', transitions: [{ from: 'a', to: 'b' }] },
    ]);
  });
});

describe('nextValue', () => {
  const toggle =
    parseInteractions('state:closed=open,open=closed')[0]?.transitions ?? [];

  it('follows the transition from the current value', () => {
    expect(nextValue(toggle, 'closed')).toBe('open');
    expect(nextValue(toggle, 'open')).toBe('closed');
  });

  it('is null when no transition starts at the current value', () => {
    expect(nextValue(toggle, 'half')).toBeNull();
    expect(nextValue(toggle, null)).toBeNull();
  });

  it('prefers an exact from over *', () => {
    const t =
      parseInteractions('state:*=closed,closed=open')[0]?.transitions ?? [];
    expect(nextValue(t, 'closed')).toBe('open');
    expect(nextValue(t, 'half')).toBe('closed');
  });
});

describe('declaresInteractions', () => {
  it('finds a click, outside, or Escape attribute in a source', () => {
    expect(declaresInteractions('<button data-scamp-click="state:a=b">')).toBe(
      true,
    );
    expect(
      declaresInteractions('<div data-scamp-outside="state:open=closed">'),
    ).toBe(true);
    expect(
      declaresInteractions('<div data-scamp-escape="state:open=closed">'),
    ).toBe(true);
    expect(declaresInteractions('<div data-state={state}>')).toBe(false);
  });
});
