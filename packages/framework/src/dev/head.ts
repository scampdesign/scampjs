import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The project's `design/head.html`, trimmed, or empty when it has none.
 * Read by the dev server per request and by the build once; never by the
 * server bundle, which gets the text baked in (it may have no filesystem).
 */
export const projectHead = (root: string): string => {
  try {
    return readFileSync(join(root, 'design', 'head.html'), 'utf8').trim();
  } catch {
    return '';
  }
};
