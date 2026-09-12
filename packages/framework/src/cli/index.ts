/**
 * The `scamp` binary. `dev` starts the server and prints the readiness
 * line CONTRACT.md section 2.1 fixes; the other commands say which
 * release brings them and exit 1.
 */
import { readFileSync } from 'node:fs';
import { createDevServer } from '../dev/server.js';
import { parseArgs, USAGE } from './args.js';

const version = (): string => {
  const pkg = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  return pkg.version;
};

const runDev = async (port: number, json: boolean): Promise<void> => {
  const server = await createDevServer({ root: process.cwd(), port, json });
  process.stdout.write(`scamp dev ready ${server.url}\n`);
  const stop = (): void => {
    void server.close().then(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
};

export const main = async (argv: ReadonlyArray<string>): Promise<number> => {
  const parsed = parseArgs(argv);
  switch (parsed.command) {
    case 'help':
      process.stdout.write(USAGE);
      return 0;
    case 'version':
      process.stdout.write(`${version()}\n`);
      return 0;
    case 'error':
      process.stderr.write(`${parsed.message}\n\n${USAGE}`);
      return 1;
    case 'build':
    case 'preview':
    case 'add':
      process.stderr.write(
        `scamp ${parsed.command} arrives with a later scampjs release. Follow https://github.com/scampdesign/scampjs.\n`,
      );
      return 1;
    case 'dev':
      try {
        await runDev(parsed.args.port, parsed.args.json);
      } catch (err) {
        process.stderr.write(
          `scamp dev could not start: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        return 1;
      }
      return -1;
  }
};

const code = await main(process.argv.slice(2));
if (code >= 0) process.exit(code);
