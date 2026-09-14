import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// Runs the built binary, so `npm run build` precedes this file (the
// root `pretest` script does that). This is the app's side of the
// contract: the readiness line, --json, and exit codes.

const bin = resolve(import.meta.dirname, '..', 'bin', 'scamp.js');
const fixture = resolve(import.meta.dirname, '..', 'fixtures', 'contract-0');

const lines = (chunks: string[]): string[] =>
  chunks
    .join('')
    .split('\n')
    .filter((l) => l !== '');

const waitFor = (
  child: ChildProcess,
  out: string[],
  predicate: () => boolean,
  ms: number,
): Promise<void> =>
  new Promise((resolveWait, reject) => {
    const started = Date.now();
    const tick = (): void => {
      if (predicate()) {
        resolveWait();
      } else if (Date.now() - started > ms) {
        reject(new Error(`timed out; stdout so far: ${out.join('')}`));
      } else {
        setTimeout(tick, 25);
      }
    };
    child.once('exit', (code) => {
      if (!predicate())
        reject(
          new Error(
            `exited with ${code} before ready; stdout: ${out.join('')}`,
          ),
        );
    });
    tick();
  });

describe('the scamp binary', () => {
  const children: ChildProcess[] = [];
  afterAll(() => {
    for (const child of children) child.kill('SIGKILL');
  });

  it('dev prints the readiness line first, logs JSON per request, and exits 0 on SIGINT', async () => {
    const child = spawn(process.execPath, [bin, 'dev', '--json'], {
      cwd: fixture,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    const out: string[] = [];
    const err: string[] = [];
    child.stdout
      ?.setEncoding('utf8')
      .on('data', (chunk: string) => out.push(chunk));
    child.stderr
      ?.setEncoding('utf8')
      .on('data', (chunk: string) => err.push(chunk));
    await waitFor(child, out, () => lines(out).length >= 1, 20_000);
    const ready = lines(out)[0] ?? '';
    const url = /^scamp dev ready (http:\/\/127\.0\.0\.1:\d+)$/.exec(
      ready,
    )?.[1];
    expect(url, `stderr: ${err.join('')}`).toBeDefined();

    const res = await fetch(`${url ?? ''}/`);
    expect(res.status).toBe(200);
    await waitFor(child, out, () => lines(out).length >= 2, 10_000);
    const entry = JSON.parse(lines(out)[1] ?? '') as Record<string, unknown>;
    expect(entry).toMatchObject({
      kind: 'request',
      method: 'GET',
      path: '/',
      status: 200,
    });
    expect(typeof entry['t']).toBe('string');
    expect(typeof entry['ms']).toBe('number');

    const exit = new Promise<number | null>((resolveExit) =>
      child.once('exit', (code) => resolveExit(code)),
    );
    child.kill('SIGINT');
    expect(await exit).toBe(0);
  }, 40_000);

  it('dev --port binds the requested port', async () => {
    const port = 40000 + Math.floor(Math.random() * 10000);
    const child = spawn(
      process.execPath,
      [bin, 'dev', '--port', String(port)],
      { cwd: fixture, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    children.push(child);
    const out: string[] = [];
    child.stdout
      ?.setEncoding('utf8')
      .on('data', (chunk: string) => out.push(chunk));
    await waitFor(child, out, () => lines(out).length >= 1, 20_000);
    expect(lines(out)[0]).toBe(`scamp dev ready http://127.0.0.1:${port}`);
    child.kill('SIGTERM');
  }, 30_000);

  it('dev exits 1 with the reason when it cannot start', () => {
    const result = spawnSync(process.execPath, [bin, 'dev'], {
      cwd: resolve(fixture, '..'),
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('scamp dev could not start');
  });

  it('add says which release brings it and exits 1', () => {
    const result = spawnSync(process.execPath, [bin, 'add', 'drizzle'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('later scampjs release');
  });

  it("build refuses the fixture's lobby route, which needs a server, and says so", () => {
    // The contract-0 fixture's lobby is a dynamic client route with load()
    // and no params(): exactly what a static folder cannot serve.
    const result = spawnSync(process.execPath, [bin, 'build'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('routes/game/[token]/lobby.tsx');
    expect(result.stderr).toContain('params()');
  }, 60_000);

  it('preview exits 1 without a dist/ folder', () => {
    const result = spawnSync(process.execPath, [bin, 'preview'], {
      cwd: resolve(fixture, 'views'),
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('scamp build first');
  });

  it('--version prints the package version', () => {
    const result = spawnSync(process.execPath, [bin, '--version'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
