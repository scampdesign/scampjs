/**
 * The dev adapter's `env`: `process.env` with `.dev.vars` on top. The
 * file is the Cloudflare convention (`KEY=value` per line) so a project
 * that deploys there keeps one file for local secrets.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEV_VARS_FILE = '.dev.vars';

/** Parse `KEY=value` lines. Comments, blanks, `export `, and matching quotes are handled. */
export const parseDevVars = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/, '');
    let value = line.slice(eq + 1).trim();
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);
    if (key !== '') out[key] = value;
  }
  return out;
};

/** `process.env` (string values only) overlaid with the project's `.dev.vars`. */
export const readEnv = (root: string): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value;
  }
  let text: string;
  try {
    text = readFileSync(join(root, DEV_VARS_FILE), 'utf8');
  } catch {
    return env;
  }
  return { ...env, ...parseDevVars(text) };
};
