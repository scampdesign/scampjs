/**
 * `scampjs/templates` — the files a new project, view, or component
 * starts from. `create-scampjs` and the Scamp app's New project scaffold
 * both call these, so the two write identical files. The view and
 * component forms match the Scamp app's generator byte for byte, which
 * is what lets the app open a scaffolded file without rewriting it.
 * See CONTRACT.md, section 3.
 */
import { readFileSync } from 'node:fs';
import { CONTRACT_VERSION } from '../contract.js';
import { DEFAULT_THEME_CSS } from './themeCss.js';

/** Relative POSIX path from the project root → file contents. */
export type FileMap = Record<string, string>;

/** Options for scaffolding a whole project. */
export type ProjectTemplateOptions = {
  /** The project name, used for package.json and the document title. */
  name: string;
  /**
   * The `scampjs` version range to pin in package.json. Defaults to a
   * caret range on this package's own version; a tool that bundles the
   * templates (the Scamp app) passes the version it was built against.
   */
  scampjsVersion?: string;
};

/** Scaffolds a whole project: views/, routes/index.tsx, design/, package.json. */
export type ProjectTemplate = (opts: ProjectTemplateOptions) => FileMap;

/** Scaffolds `views/<Name>/<Name>.tsx` and its CSS module. */
export type ViewTemplate = (name: string) => FileMap;

/** Scaffolds `components/<Name>/<Name>.tsx` and its CSS module. */
export type ComponentTemplate = (name: string) => FileMap;

/** A view or component name: PascalCase letters and digits. */
export const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

const assertName = (name: string): void => {
  if (!NAME_RE.test(name)) {
    throw new Error(
      `"${name}" is not a valid name; use PascalCase letters and digits, such as "HeroCard".`,
    );
  }
};

/** The empty form of a view or component (CONTRACT.md section 1.2). */
export const emptyViewTsx = (
  name: string,
): string => `import styles from './${name}.module.css';

type ${name}Props = {
  className?: string;
};

export default function ${name}({ className }: ${name}Props) {
  return (
    <div data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`} />
  );
}

export const _scamp = { contract: ${CONTRACT_VERSION}, events: [] } as const;
`;

/** No `min-height: 100vh`: a root sizes to its content; the shell's `body` owns the viewport. */
export const EMPTY_VIEW_CSS = `.root {
  width: 100%;
  position: relative;
}
`;

export const viewTemplate: ViewTemplate = (name) => {
  assertName(name);
  return {
    [`views/${name}/${name}.tsx`]: emptyViewTsx(name),
    [`views/${name}/${name}.module.css`]: EMPTY_VIEW_CSS,
  };
};

export const componentTemplate: ComponentTemplate = (name) => {
  assertName(name);
  return {
    [`components/${name}/${name}.tsx`]: emptyViewTsx(name),
    [`components/${name}/${name}.module.css`]: EMPTY_VIEW_CSS,
  };
};

/** This package's own version, so a scaffold pins the scampjs that wrote it. */
export const scampjsVersion = (): string => {
  const pkg = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  return pkg.version;
};

const packageJson = (name: string, scampjs: string): string =>
  `${JSON.stringify(
    {
      name,
      private: true,
      type: 'module',
      scripts: {
        dev: 'scamp dev',
        build: 'scamp build',
        preview: 'scamp preview',
      },
      dependencies: { preact: '^10.29.0', scampjs },
    },
    null,
    2,
  )}\n`;

const TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      jsxImportSource: 'preact',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      baseUrl: '.',
      paths: {
        '@/*': ['./*'],
        react: ['./node_modules/preact/compat/'],
        'react-dom': ['./node_modules/preact/compat/'],
      },
    },
    include: ['views', 'components', 'routes', 'lib', 'scamp-env.d.ts'],
  },
  null,
  2,
)}\n`;

const SCAMP_ENV = `// Augments the framework's Env so \`env.X\` is typed in load(). Each
// adapter documents what it puts here.
declare module 'scampjs/runtime' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Env {}
}

export {};
`;

const GITIGNORE = `node_modules
dist
.vite
.dev.vars
.scamp
`;

/**
 * The framework's document shell has no layout of its own, so the body
 * rules a Next.js layout sets inline live in the theme, where the
 * contract puts body rules (section 1.7). The Scamp canvas assumes them.
 */
const BODY_RULES = `body {
  margin: 0;
  min-height: 100vh;
}
`;

const HOME_ROUTE = `import Home from '@/views/Home/Home';

export const render = 'static';

export default function HomeRoute() {
  return <Home />;
}
`;

const agentMd = (name: string): string => `# ${name}

This project is written in the Scamp framework (\`scampjs\`). A page is
three files with one owner each:

- \`views/<Name>/<Name>.tsx\` + \`.module.css\`: the page's design. The
  Scamp app owns and regenerates these.
- \`routes/\`: the logic. A route file loads data and renders a view. Yours.
- \`design/theme.css\`: the design tokens.

Open the folder in the Scamp app for the full agent instructions. The
file shapes are in \`node_modules/scampjs/CONTRACT.md\`.
`;

export const projectTemplate: ProjectTemplate = ({
  name,
  scampjsVersion: pinned,
}) => ({
  'package.json': packageJson(name, pinned ?? `^${scampjsVersion()}`),
  'tsconfig.json': TSCONFIG,
  'scamp-env.d.ts': SCAMP_ENV,
  '.gitignore': GITIGNORE,
  'agent.md': agentMd(name),
  'design/theme.css': `${DEFAULT_THEME_CSS}\n${BODY_RULES}`,
  'routes/index.tsx': HOME_ROUTE,
  ...viewTemplate('Home'),
});
