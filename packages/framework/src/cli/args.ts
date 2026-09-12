/** Argument parsing for the `scamp` binary. Pure, so the CLI's contract is unit-tested. */

export type DevArgs = { port: number; json: boolean };

export type ParsedArgs =
  | { command: 'dev'; args: DevArgs }
  | { command: 'build' | 'preview' | 'add'; args: string[] }
  | { command: 'version' }
  | { command: 'help' }
  | { command: 'error'; message: string };

export const USAGE = `Usage: scamp <command>

  scamp dev [--port <n>] [--json]   start the dev server
  scamp build                       (arrives with a later release)
  scamp preview                     (arrives with a later release)
  scamp add <recipe>                (arrives with a later release)

  scamp --version
`;

const parseDev = (argv: ReadonlyArray<string>): ParsedArgs => {
  let port = 0;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--json') {
      json = true;
      continue;
    }
    let value: string | undefined;
    if (arg === '--port') {
      value = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--port=')) {
      value = arg.slice('--port='.length);
    } else {
      return {
        command: 'error',
        message: `Unknown option for scamp dev: ${arg}`,
      };
    }
    const n = Number(value);
    if (
      value === undefined ||
      value === '' ||
      !Number.isInteger(n) ||
      n < 0 ||
      n > 65535
    ) {
      return {
        command: 'error',
        message: `--port needs a number from 0 to 65535, got "${value ?? ''}".`,
      };
    }
    port = n;
  }
  return { command: 'dev', args: { port, json } };
};

export const parseArgs = (argv: ReadonlyArray<string>): ParsedArgs => {
  const [command, ...rest] = argv;
  switch (command) {
    case undefined:
    case '--help':
    case '-h':
    case 'help':
      return { command: 'help' };
    case '--version':
    case '-v':
      return { command: 'version' };
    case 'dev':
      return parseDev(rest);
    case 'build':
    case 'preview':
    case 'add':
      return { command, args: rest };
    default:
      return { command: 'error', message: `Unknown command: ${command}` };
  }
};
