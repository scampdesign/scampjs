/**
 * The document shell. There is no `layout.tsx`: every route and every
 * `/_views/<Name>` renders inside this, with `design/theme.css` first.
 */

export type ShellOptions = {
  title: string;
  /** Inlined `<style>` blocks, theme first. */
  styles: ReadonlyArray<string>;
  /** Rendered markup for `#scamp-root`. */
  body: string;
  /** `<script type="module">` sources, in order. */
  scripts?: ReadonlyArray<string>;
  /** Serialised JSON the hydration entry reads; omitted when there is none. */
  data?: string;
};

export const ROOT_ID = 'scamp-root';
export const DATA_ID = 'scamp-data';

export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// `</script` inside JSON would end the data block early.
const escapeJson = (json: string): string => json.replace(/</g, '\\u003c');

export const documentShell = (opts: ShellOptions): string => {
  const styles = opts.styles.map((css) => `<style>${css}</style>`);
  const scripts = (opts.scripts ?? []).map(
    (src) => `<script type="module" src="${escapeHtml(src)}"></script>`,
  );
  const data =
    opts.data === undefined
      ? []
      : [
          `<script id="${DATA_ID}" type="application/json">${escapeJson(opts.data)}</script>`,
        ];
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(opts.title)}</title>`,
    ...styles,
    '</head>',
    '<body>',
    `<div id="${ROOT_ID}">${opts.body}</div>`,
    ...data,
    ...scripts,
    '</body>',
    '</html>',
    '',
  ].join('\n');
};
