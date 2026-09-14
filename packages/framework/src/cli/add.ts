/**
 * `scamp add <recipe>`: apply a recipe from `scampjs/templates` to the
 * project in the working directory. Reads the files the recipe touches,
 * merges through `applyRecipe`, writes what changed, and says what to
 * run next.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FileMap } from '../templates/index.js';
import { applyRecipe } from '../templates/recipe.js';
import type { Recipe } from '../templates/recipe.js';
import {
  DRIZZLE_DIALECTS,
  drizzleRecipe,
  isDrizzleDialect,
} from '../templates/recipes/drizzle.js';

export type AddOptions = { dialect?: string; force: boolean };

const TOUCHED = [
  'package.json',
  'scamp-env.d.ts',
  '.dev.vars',
  '.gitignore',
  'agent.md',
];

export const RECIPES = ['drizzle'] as const;

export const recipeFor = (name: string, opts: AddOptions): Recipe => {
  if (name === 'drizzle') {
    const dialect = opts.dialect ?? 'sqlite';
    if (!isDrizzleDialect(dialect)) {
      throw new Error(
        `--dialect must be one of ${DRIZZLE_DIALECTS.join(', ')}, got "${dialect}".`,
      );
    }
    return drizzleRecipe(dialect);
  }
  throw new Error(
    `Unknown recipe "${name}". Available: ${RECIPES.join(', ')}.`,
  );
};

export type AddResult = { written: string[]; next: string[] };

export const runAdd = (
  root: string,
  name: string,
  opts: AddOptions,
): AddResult => {
  if (!existsSync(join(root, 'package.json'))) {
    throw new Error(
      `${root} has no package.json; run scamp add from the project root.`,
    );
  }
  const recipe = recipeFor(name, opts);
  const current: FileMap = {};
  for (const path of [...TOUCHED, ...Object.keys(recipe.files)]) {
    const full = join(root, path);
    if (existsSync(full)) current[path] = readFileSync(full, 'utf8');
  }
  // A RecipeConflict's message already names the file and the fix.
  const changes: FileMap = applyRecipe(current, recipe, { force: opts.force });
  for (const [path, content] of Object.entries(changes)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  const written = Object.keys(changes).sort();
  const next =
    written.length === 0
      ? []
      : ['npm install', 'npm run db:generate', 'npm run db:migrate'];
  return { written, next };
};
