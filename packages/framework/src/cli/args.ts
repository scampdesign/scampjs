/** Argument parsing for the `scamp` binary. Pure, so the CLI's contract is unit-tested. */

export type DevArgs = { port: number; json: boolean };

export type ParsedArgs =
  | { command: 'dev'; args: DevArgs }
  | { command: 'build' }
  | { command: 'preview'; args: { port: number } }
  | {
      command: 'add';
      args: { recipe: string; dialect?: string; force: boolean };
    }
  | { command: 'version' }
  | { command: 'help' }
  | { command: 'error'; message: string };

export const USAGE = `Usage: scamp <command>

  scamp dev [--port <n>] [--json]   start the dev server
  scamp build                       prerender every route into dist/
  scamp preview [--port <n>]        serve dist/ as a static host would
  scamp add drizzle [--dialect sqlite|postgres|d1] [--force]
                                    add a database through Drizzle

  scamp --version
`;

const parsePort = (
  command: string,
  argv: ReadonlyArray<string>,
  allowJson: boolean,
): { port: number; json: boolean } | { command: 'error'; message: string } => {
  let port = 0;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (allowJson && arg === '--json') {
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
  return { port, json };
};

const parseAdd = (argv: ReadonlyArray<string>): ParsedArgs => {
  const [recipe, ...rest] = argv;
  if (recipe === undefined || recipe.startsWith('-')) {
    return {
      command: 'error',
      message: 'scamp add needs a recipe name, e.g. scamp add drizzle.',
    };
  }
  let dialect: string | undefined;
  let force = false;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i] ?? '';
    if (arg === '--force') force = true;
    else if (arg === '--dialect') {
      dialect = rest[i + 1];
      i += 1;
    } else if (arg.startsWith('--dialect='))
      dialect = arg.slice('--dialect='.length);
    else
      return {
        command: 'error',
        message: `Unknown option for scamp add: ${arg}`,
      };
  }
  return {
    command: 'add',
    args: { recipe, ...(dialect === undefined ? {} : { dialect }), force },
  };
};

const parseDev = (argv: ReadonlyArray<string>): ParsedArgs => {
  const parsed = parsePort('dev', argv, true);
  return 'command' in parsed ? parsed : { command: 'dev', args: parsed };
};

const parsePreview = (argv: ReadonlyArray<string>): ParsedArgs => {
  const parsed = parsePort('preview', argv, false);
  return 'command' in parsed
    ? parsed
    : { command: 'preview', args: { port: parsed.port } };
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
      return rest.length === 0
        ? { command: 'build' }
        : {
            command: 'error',
            message: `scamp build takes no options, got: ${rest.join(' ')}`,
          };
    case 'preview':
      return parsePreview(rest);
    case 'add':
      return parseAdd(rest);
    default:
      return { command: 'error', message: `Unknown command: ${command}` };
  }
};
