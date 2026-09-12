import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDevVars, readEnv } from '../src/dev/env.js';

describe('parseDevVars', () => {
  it('reads KEY=value lines and skips blanks and comments', () => {
    expect(parseDevVars('# secrets\n\nDB=memory\nAPI_KEY = abc \n')).toEqual({
      DB: 'memory',
      API_KEY: 'abc',
    });
  });

  it('strips matching quotes and the export prefix, and keeps = inside a value', () => {
    expect(
      parseDevVars(
        'export URL="postgres://u:p@h/db?x=1"\nTOKEN=\'a=b\'\nRAW="unterminated',
      ),
    ).toEqual({
      URL: 'postgres://u:p@h/db?x=1',
      TOKEN: 'a=b',
      RAW: '"unterminated',
    });
  });

  it('ignores lines without a key', () => {
    expect(parseDevVars('=nokey\nnovalue\n')).toEqual({});
  });
});

describe('readEnv', () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir !== null) rmSync(dir, { recursive: true, force: true });
    dir = null;
    delete process.env['SCAMP_TEST_ONLY'];
  });

  it('overlays .dev.vars on process.env', () => {
    dir = mkdtempSync(join(tmpdir(), 'scamp-env-'));
    process.env['SCAMP_TEST_ONLY'] = 'from-process';
    writeFileSync(
      join(dir, '.dev.vars'),
      'SCAMP_TEST_ONLY=from-file\nGREETING=hi\n',
    );
    const env = readEnv(dir);
    expect(env['SCAMP_TEST_ONLY']).toBe('from-file');
    expect(env['GREETING']).toBe('hi');
    expect(env['PATH']).toBe(process.env['PATH']);
  });

  it('is process.env alone when there is no .dev.vars', () => {
    dir = mkdtempSync(join(tmpdir(), 'scamp-env-'));
    expect(readEnv(dir)['GREETING']).toBeUndefined();
  });
});
