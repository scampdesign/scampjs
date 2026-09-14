/**
 * The contract version this package implements, on its own so leaf
 * modules (the templates, the runtime) can import it without pulling
 * in the build or the dev server. Mirrors `scampjs.contract` in
 * package.json; a test keeps the two equal. See CONTRACT.md.
 */
export const CONTRACT_VERSION = 1 as const;
