import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTRACT_VERSION } from '../src/index.js';
import {
  componentTemplate,
  EMPTY_VIEW_CSS,
  emptyViewTsx,
  projectTemplate,
  scampjsVersion,
  viewTemplate,
} from '../src/templates/index.js';

describe('viewTemplate and componentTemplate', () => {
  it('write the empty form of the contract: imports, className-only props, root, _scamp', () => {
    expect(viewTemplate('Lobby')).toEqual({
      'views/Lobby/Lobby.tsx': emptyViewTsx('Lobby'),
      'views/Lobby/Lobby.module.css': EMPTY_VIEW_CSS,
    });
    expect(emptyViewTsx('Lobby')).toBe(`import styles from './Lobby.module.css';

type LobbyProps = {
  className?: string;
};

export default function Lobby({ className }: LobbyProps) {
  return (
    <div data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`} />
  );
}

export const _scamp = { contract: ${CONTRACT_VERSION}, events: [] } as const;
`);
    expect(Object.keys(componentTemplate('Card'))).toEqual([
      'components/Card/Card.tsx',
      'components/Card/Card.module.css',
    ]);
  });

  it('refuse a name that is not PascalCase', () => {
    expect(() => viewTemplate('hero-card')).toThrow('PascalCase');
    expect(() => componentTemplate('card')).toThrow('PascalCase');
  });
});

describe('projectTemplate', () => {
  const files = projectTemplate({ name: 'noise' });

  it('scaffolds the layout CONTRACT.md section 1.1 names', () => {
    expect(Object.keys(files).sort()).toEqual([
      '.gitignore',
      'agent.md',
      'design/theme.css',
      'package.json',
      'routes/index.tsx',
      'scamp-env.d.ts',
      'tsconfig.json',
      'views/Home/Home.module.css',
      'views/Home/Home.tsx',
    ]);
  });

  it('pins scampjs to this package version and preact as a dependency', () => {
    const pkg = JSON.parse(files['package.json'] ?? '') as {
      name: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    const own = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '..', 'package.json'), 'utf8'),
    ) as {
      version: string;
    };
    expect(scampjsVersion()).toBe(own.version);
    expect(pkg.name).toBe('noise');
    expect(pkg.scripts).toEqual({
      dev: 'scamp dev',
      build: 'scamp build',
      preview: 'scamp preview',
    });
    expect(pkg.dependencies).toEqual({
      preact: '^10.29.0',
      scampjs: `^${own.version}`,
    });
  });

  it('maps @/ to the root and react to preact/compat in tsconfig', () => {
    const tsconfig = JSON.parse(files['tsconfig.json'] ?? '') as {
      compilerOptions: {
        paths: Record<string, string[]>;
        jsxImportSource: string;
      };
    };
    expect(tsconfig.compilerOptions.jsxImportSource).toBe('preact');
    expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./*']);
    expect(tsconfig.compilerOptions.paths['react']).toEqual([
      './node_modules/preact/compat/',
    ]);
  });

  it('renders Home from a static index route and ships the theme tokens', () => {
    expect(files['routes/index.tsx']).toContain(
      "import Home from '@/views/Home/Home';",
    );
    expect(files['routes/index.tsx']).toContain(
      "export const render = 'static';",
    );
    expect(files['design/theme.css']).toContain(
      '--color-primary: var(--color-brand-500);',
    );
    expect(files['design/theme.css']).toContain(
      'body {\n  font-family: var(--font-sans);\n}',
    );
  });
});
