// Copies the root CONTRACT.md and LICENSE into the package being packed so
// they ship on npm. Run by each package's `prepack` script with the
// package directory as cwd. The copies are gitignored; the root files are
// the source of truth.
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..', '..');
const wanted = process.argv.slice(2);
for (const name of wanted) {
  const from = resolve(root, name);
  if (!existsSync(from)) {
    console.error(`prepack: ${name} not found at ${from}`);
    process.exit(1);
  }
  copyFileSync(from, resolve(process.cwd(), name));
}
