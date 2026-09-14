/**
 * A recipe is what `scamp add <name>` and `create-scampjs`'s database
 * question write: new files, plus additions to the files a project
 * already has. `applyRecipe` merges it into a file map, so both callers
 * produce the same result and the merge is unit-tested without a disk.
 */
import type { FileMap } from './index.js';

export type Recipe = {
  name: string;
  /** New files. Applying refuses to overwrite one that exists with other contents. */
  files: FileMap;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  /** `KEY=value` lines added to `.dev.vars` when the key is absent. */
  devVars: Record<string, string>;
  /** `Env` fields added to `scamp-env.d.ts`: name → TypeScript type. */
  env: Record<string, string>;
  /** `/// <reference types="…" />` lines the augmentation needs. */
  envReferences: string[];
  /** Lines added to `.gitignore` when absent. */
  gitignore: string[];
  /** A section appended to `agent.md`, under a marker so it is written once. */
  agentMd: string;
};

export class RecipeConflict extends Error {
  readonly file: string;
  constructor(file: string) {
    super(`${file} exists with other contents; move it aside or pass --force.`);
    this.name = 'RecipeConflict';
    this.file = file;
  }
}

const marker = (recipe: string): string => `<!-- scamp:recipe:${recipe} -->`;
const envMarker = (recipe: string): string => `// scamp:recipe:${recipe}`;

const mergeJson = (
  existing: string | undefined,
  recipe: Recipe,
): string => {
  let pkg: Record<string, unknown> = {};
  if (existing !== undefined) {
    const parsed: unknown = JSON.parse(existing);
    if (typeof parsed === 'object' && parsed !== null) pkg = parsed as Record<string, unknown>;
  }
  const section = (key: string, add: Record<string, string>): Record<string, string> => {
    const current = typeof pkg[key] === 'object' && pkg[key] !== null ? (pkg[key] as Record<string, string>) : {};
    const out = { ...current };
    for (const [name, value] of Object.entries(add)) if (!(name in out)) out[name] = value;
    return out;
  };
  const merged: Record<string, unknown> = {
    ...pkg,
    scripts: section('scripts', recipe.scripts),
    dependencies: section('dependencies', recipe.dependencies),
  };
  const dev = section('devDependencies', recipe.devDependencies);
  if (Object.keys(dev).length > 0) merged['devDependencies'] = dev;
  return `${JSON.stringify(merged, null, 2)}\n`;
};

const appendLines = (existing: string | undefined, lines: string[], header?: string): string => {
  const have = new Set((existing ?? '').split('\n').map((l) => l.trim()));
  const missing = lines.filter((l) => !have.has(l.trim()));
  if (missing.length === 0) return existing ?? '';
  const base = existing === undefined || existing === '' ? '' : `${existing.replace(/\s*$/, '\n')}\n`;
  return `${base}${header === undefined ? '' : `${header}\n`}${missing.join('\n')}\n`;
};

const envBlock = (recipe: Recipe): string => {
  const refs = recipe.envReferences.map((r) => `/// <reference types="${r}" />`);
  const fields = Object.entries(recipe.env).map(([name, type]) => `    ${name}: ${type};`);
  return `${envMarker(recipe.name)}
${refs.length > 0 ? `${refs.join('\n')}\n` : ''}declare module 'scampjs/runtime' {
  interface Env {
${fields.join('\n')}
  }
}
`;
};

/**
 * Merge a recipe into a project's files. `files` holds what the project
 * has for the paths the recipe touches (absent keys are files that do
 * not exist). Returns only the paths that change. Applying the same
 * recipe twice changes nothing the second time.
 */
export const applyRecipe = (
  files: FileMap,
  recipe: Recipe,
  opts: { force?: boolean } = {},
): FileMap => {
  const out: FileMap = {};
  for (const [path, content] of Object.entries(recipe.files)) {
    const existing = files[path];
    if (existing === undefined) {
      out[path] = content;
    } else if (existing !== content) {
      if (opts.force !== true) throw new RecipeConflict(path);
      out[path] = content;
    }
  }
  const pkg = mergeJson(files['package.json'], recipe);
  if (pkg !== files['package.json']) out['package.json'] = pkg;

  if (Object.keys(recipe.env).length > 0) {
    const existing = files['scamp-env.d.ts'] ?? "declare module 'scampjs/runtime' {\n  interface Env {}\n}\n\nexport {};\n";
    if (!existing.includes(envMarker(recipe.name))) {
      const withoutExport = existing.replace(/\n*export \{\};\s*$/, '\n');
      out['scamp-env.d.ts'] = `${withoutExport.replace(/\s*$/, '\n')}\n${envBlock(recipe)}\nexport {};\n`;
    }
  }
  const devVars = appendLines(
    files['.dev.vars'],
    Object.entries(recipe.devVars).map(([k, v]) => `${k}=${v}`),
  );
  if (devVars !== (files['.dev.vars'] ?? '')) out['.dev.vars'] = devVars;
  if (recipe.gitignore.length > 0) {
    const ignore = appendLines(files['.gitignore'], recipe.gitignore, `# ${recipe.name}`);
    if (ignore !== (files['.gitignore'] ?? '')) out['.gitignore'] = ignore;
  }
  const agent = files['agent.md'];
  if (agent !== undefined && !agent.includes(marker(recipe.name))) {
    out['agent.md'] = `${agent.replace(/\s*$/, '\n')}\n${marker(recipe.name)}\n${recipe.agentMd.replace(/\s*$/, '\n')}`;
  }
  return out;
};
