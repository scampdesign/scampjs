import { describe, expect, it } from 'vitest';
import { createLog } from '../src/dev/log.js';

const sink = (): { lines: string[]; write: (chunk: string) => void } => {
  const lines: string[] = [];
  return { lines, write: (chunk): void => void lines.push(chunk) };
};

describe('createLog', () => {
  const now = (): Date => new Date('2026-09-10T15:00:00.000Z');

  it('with --json writes one object per line to stdout in the contract shape', () => {
    const out = sink();
    const err = sink();
    const log = createLog({ json: true, stdout: out, stderr: err, now });
    log.request({
      method: 'GET',
      path: '/game/KZQ4/lobby',
      status: 200,
      ms: 12,
    });
    log.error({ path: '/x', message: 'boom', stack: 'Error: boom' });
    expect(out.lines.map((l) => JSON.parse(l) as unknown)).toEqual([
      {
        t: '2026-09-10T15:00:00.000Z',
        kind: 'request',
        method: 'GET',
        path: '/game/KZQ4/lobby',
        status: 200,
        ms: 12,
      },
      {
        t: '2026-09-10T15:00:00.000Z',
        kind: 'error',
        path: '/x',
        message: 'boom',
        stack: 'Error: boom',
      },
    ]);
    expect(err.lines).toEqual([]);
  });

  it('without --json writes human lines to stderr and nothing to stdout', () => {
    const out = sink();
    const err = sink();
    const log = createLog({ json: false, stdout: out, stderr: err, now });
    log.request({ method: 'GET', path: '/', status: 404, ms: 1 });
    expect(out.lines).toEqual([]);
    expect(err.lines).toEqual(['GET / 404 1ms\n']);
  });
});
