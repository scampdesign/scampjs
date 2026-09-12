/**
 * The views a project has: every `views/<Name>/<Name>.tsx`. Components
 * are not listed; `/_views/` is a page preview, not a catalogue.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const VIEW_NAME = /^[A-Z][A-Za-z0-9]*$/;

export const viewFile = (root: string, name: string): string =>
  join(root, 'views', name, `${name}.tsx`);

export const listViews = (root: string): string[] => {
  const dir = join(root, 'views');
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter(
      (name) =>
        VIEW_NAME.test(name) &&
        statSync(join(dir, name)).isDirectory() &&
        existsSync(viewFile(root, name)),
    )
    .sort();
};
