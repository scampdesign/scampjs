import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli/args.js';

describe('parseArgs', () => {
  it('parses dev with a free port and no json by default', () => {
    expect(parseArgs(['dev'])).toEqual({
      command: 'dev',
      args: { port: 0, json: false },
    });
  });

  it('reads --port in both forms and --json', () => {
    expect(parseArgs(['dev', '--port', '4173', '--json'])).toEqual({
      command: 'dev',
      args: { port: 4173, json: true },
    });
    expect(parseArgs(['dev', '--port=3000'])).toEqual({
      command: 'dev',
      args: { port: 3000, json: false },
    });
  });

  it('rejects a bad port or an unknown option', () => {
    expect(parseArgs(['dev', '--port', 'abc']).command).toBe('error');
    expect(parseArgs(['dev', '--port', '70000']).command).toBe('error');
    expect(parseArgs(['dev', '--port']).command).toBe('error');
    expect(parseArgs(['dev', '--watch']).command).toBe('error');
  });

  it('names the reserved commands and help and version', () => {
    expect(parseArgs(['build'])).toEqual({ command: 'build', args: [] });
    expect(parseArgs(['add', 'drizzle'])).toEqual({
      command: 'add',
      args: ['drizzle'],
    });
    expect(parseArgs([])).toEqual({ command: 'help' });
    expect(parseArgs(['--version'])).toEqual({ command: 'version' });
    expect(parseArgs(['frobnicate']).command).toBe('error');
  });
});
