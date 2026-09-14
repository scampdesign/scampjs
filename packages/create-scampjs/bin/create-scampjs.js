#!/usr/bin/env node
// `npm create scampjs [dir]`: scaffold a Scamp-framework project from the
// framework's own templates export, so a project made here and one made
// in the Scamp app carry identical files. Prompts for what it can't
// infer; every prompt has a flag so it also runs unattended.
import { mkdirSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { projectTemplate } from 'scampjs/templates';

const USAGE = `Usage: npm create scampjs [dir] [--name <name>] [--db none] [--yes]

  dir        folder to create (default: the project name)
  --name     package name (default: the folder's name, or my-scamp-app)
  --db       database recipe; only "none" exists yet
  --yes, -y  take the defaults without asking
`;

const DATABASES = ['none'];
const NAME_RE = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

const parse = (argv) => {
  const out = { dir: null, name: null, db: null, yes: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '-y') out.yes = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--name') out.name = argv[++i] ?? '';
    else if (arg.startsWith('--name=')) out.name = arg.slice(7);
    else if (arg === '--db') out.db = argv[++i] ?? '';
    else if (arg.startsWith('--db=')) out.db = arg.slice(5);
    else if (arg.startsWith('-')) return { error: `Unknown option: ${arg}` };
    else if (out.dir === null) out.dir = arg;
    else return { error: `Unexpected argument: ${arg}` };
  }
  return out;
};

const ask = async (rl, question, fallback) => {
  const answer = (await rl.question(`${question} (${fallback}) `)).trim();
  return answer === '' ? fallback : answer;
};

const main = async () => {
  const args = parse(process.argv.slice(2));
  if ('error' in args) {
    process.stderr.write(`${args.error}\n\n${USAGE}`);
    return 1;
  }
  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const interactive = !args.yes && process.stdin.isTTY === true;
  const rl = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : null;

  const defaultName =
    args.dir !== null ? basename(resolve(args.dir)) : 'my-scamp-app';
  let name =
    args.name ??
    (rl ? await ask(rl, 'Project name?', defaultName) : defaultName);
  name = name.trim().toLowerCase();
  if (!NAME_RE.test(name)) {
    rl?.close();
    process.stderr.write(
      `"${name}" is not a valid package name: lowercase letters, digits, ., _, and - only.\n`,
    );
    return 1;
  }
  const db =
    args.db ??
    (rl
      ? await ask(rl, `Database? [${DATABASES.join(', ')}]`, 'none')
      : 'none');
  if (!DATABASES.includes(db)) {
    rl?.close();
    process.stderr.write(
      `Database "${db}" is not available yet; only ${DATABASES.join(', ')} for now. Drizzle arrives with a later release.\n`,
    );
    return 1;
  }
  rl?.close();

  const dir = resolve(args.dir ?? name);
  if (existsSync(dir) && readdirSync(dir).length > 0) {
    process.stderr.write(`${dir} exists and is not empty.\n`);
    return 1;
  }
  const files = projectTemplate({ name });
  for (const [relative, content] of Object.entries(files)) {
    const target = join(dir, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  const cdPart = dir === process.cwd() ? '' : `  cd ${args.dir ?? name}\n`;
  process.stdout.write(
    `Created ${name} in ${dir} with ${Object.keys(files).length} files.\n\nNext:\n${cdPart}  npm install\n  npm run dev\n\nOpen the folder in the Scamp app to design its views.\n`,
  );
  return 0;
};

process.exit(await main());
