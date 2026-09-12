/**
 * The default `design/theme.css`, ported from the Scamp app's
 * `src/shared/templates/themeCss.ts` so a project scaffolded here and one
 * scaffolded by the app carry the same tokens and the same browser
 * reset. The app's canvas mirrors the reset inline; keep the two equal.
 */

export const DEFAULT_BODY_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';

export const BROWSER_RESET_SENTINEL =
  '/* scamp: browser reset — keep canvas and preview in sync */';

export const BROWSER_RESET_BLOCK = `${BROWSER_RESET_SENTINEL}
p,
h1,
h2,
h3,
h4,
h5,
h6,
ul,
ol,
dl,
dd,
blockquote,
figure,
pre,
hr,
fieldset {
  margin: 0;
}

img,
video,
iframe,
svg {
  display: block;
}

button,
a,
select,
input,
textarea,
fieldset,
legend {
  all: unset;
  box-sizing: border-box;
  font: inherit;
  color: inherit;
  display: block;
}

input,
textarea,
select {
  cursor: text;
  user-select: text;
}`;

export const DEFAULT_THEME_CSS = `:root {
  /* Primitives — brand */
  --color-brand-50: #eff6ff;
  --color-brand-100: #dbeafe;
  --color-brand-200: #bfdbfe;
  --color-brand-300: #93c5fd;
  --color-brand-400: #60a5fa;
  --color-brand-500: #3b82f6;
  --color-brand-600: #2563eb;
  --color-brand-700: #1d4ed8;
  --color-brand-800: #1e40af;
  --color-brand-900: #1e3a8a;

  /* Primitives — neutral */
  --color-neutral-50: #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-300: #cbd5e1;
  --color-neutral-400: #94a3b8;
  --color-neutral-500: #64748b;
  --color-neutral-600: #475569;
  --color-neutral-700: #334155;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;

  /* Primitives — error */
  --color-error-50: #fef2f2;
  --color-error-100: #fee2e2;
  --color-error-200: #fecaca;
  --color-error-300: #fca5a5;
  --color-error-400: #f87171;
  --color-error-500: #ef4444;
  --color-error-600: #dc2626;
  --color-error-700: #b91c1c;
  --color-error-800: #991b1b;
  --color-error-900: #7f1d1d;

  /* Primitives — warning */
  --color-warning-50: #fffbeb;
  --color-warning-100: #fef3c7;
  --color-warning-200: #fde68a;
  --color-warning-300: #fcd34d;
  --color-warning-400: #fbbf24;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;
  --color-warning-700: #b45309;
  --color-warning-800: #92400e;
  --color-warning-900: #78350f;

  /* Primitives — success */
  --color-success-50: #f0fdf4;
  --color-success-100: #dcfce7;
  --color-success-200: #bbf7d0;
  --color-success-300: #86efac;
  --color-success-400: #4ade80;
  --color-success-500: #22c55e;
  --color-success-600: #16a34a;
  --color-success-700: #15803d;
  --color-success-800: #166534;
  --color-success-900: #14532d;

  /* Semantic */
  --color-primary: var(--color-brand-500);
  --color-secondary: var(--color-neutral-600);
  --color-background: var(--color-neutral-50);
  --color-surface: var(--color-neutral-100);
  --color-text: var(--color-neutral-900);
  --color-muted: var(--color-neutral-500);
  --color-border: var(--color-neutral-200);
  --color-error: var(--color-error-500);
  --color-warning: var(--color-warning-500);
  --color-success: var(--color-success-500);

  /* Typography */
  --font-sans: ${DEFAULT_BODY_FONT_FAMILY};
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;

  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
}

${BROWSER_RESET_BLOCK}
`;
