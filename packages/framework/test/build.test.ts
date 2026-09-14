import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BuildError, buildProject } from '../src/build/build.js';
import { createPreviewServer, resolveStatic } from '../src/build/preview.js';
import { projectTemplate, viewTemplate } from '../src/templates/index.js';

// Projects under test/.tmp so `preact` and `scampjs` resolve through the
// workspace. Each describe block owns one project.

const TMP = resolve(import.meta.dirname, '.tmp');
const quiet = { write: (): boolean => true };

const scaffold = (name: string, extra: Record<string, string> = {}): string => {
  const dir = join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  const files = { ...projectTemplate({ name }), ...extra };
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  return dir;
};

const walk = (dir: string, base = dir): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(dir, e.name), base)
      : [join(dir, e.name).slice(base.length + 1)],
  );

const BUTTON_VIEW = `import styles from './Button.module.css';

type ButtonProps = {
  label?: string;
  onPress?: () => void;
  className?: string;
};

export default function Button({ label = "Go", onPress, className }: ButtonProps) {
  return (
    <button data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`} type="button" onClick={onPress}>{label}</button>
  );
}

export const _scamp = { contract: 1, events: ['onPress'] } as const;
`;

describe('scamp build on a scaffolded project', () => {
  let dir: string;
  beforeAll(async () => {
    dir = scaffold('build-basic', {
      // A static route with a load() that reads env and the request.
      '.dev.vars': 'GREETING=built\n',
      'routes/about.tsx': `import type { LoadContext, RouteProps } from 'scampjs/runtime';
import Home from '@/views/Home/Home';

export function load({ env, request }: LoadContext) {
  return { greeting: (env as unknown as Record<string, string>)['GREETING'], path: new URL(request.url).pathname };
}

export default function About({ data }: RouteProps<typeof load>) {
  return <main><p id="greeting">{data.greeting} at {data.path}</p><Home /></main>;
}
`,
      // A static route whose view declares an event: ships JavaScript.
      ...viewTemplate('Card'),
      'views/Button/Button.tsx': BUTTON_VIEW,
      'views/Button/Button.module.css': '.root {\n  padding: 8px;\n}\n',
      'routes/play.tsx': `import Button from '@/views/Button/Button';
import { useState } from 'preact/hooks';

export default function Play() {
  const [n, setN] = useState(0);
  return <Button label={\`Pressed \${n}\`} onPress={() => setN(n + 1)} />;
}
`,
      // A client route: always hydrates.
      'routes/app.tsx': `import Home from '@/views/Home/Home';

export const render = 'client';

export default function App() {
  return <Home />;
}
`,
      // A dynamic static route enumerated by params().
      'routes/team/[slug].tsx': `import { useParams } from 'scampjs/runtime';
import type { LoadContext, RouteProps } from 'scampjs/runtime';

export function params() {
  return [{ slug: 'alpha' }, { slug: 'beta' }];
}

export function load({ params }: LoadContext<{ slug: string }>) {
  return { title: params.slug.toUpperCase() };
}

export default function Team({ data }: RouteProps<typeof load>) {
  const p = useParams<{ slug: string }>();
  return <h1>{data.title} ({p.slug})</h1>;
}
`,
      'public/robots.txt': 'User-agent: *\n',
    });
    await buildProject({ root: dir, stderr: quiet });
  }, 120_000);
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes one index.html per page, the params() pages included, and copies public/', () => {
    const files = walk(join(dir, 'dist')).sort();
    expect(files).toContain('index.html');
    expect(files).toContain('about/index.html');
    expect(files).toContain('play/index.html');
    expect(files).toContain('app/index.html');
    expect(files).toContain('team/alpha/index.html');
    expect(files).toContain('team/beta/index.html');
    expect(files).toContain('robots.txt');
    expect(files.some((f) => f.startsWith('.vite'))).toBe(false);
    expect(existsSync(join(dir, 'node_modules', '.scamp'))).toBe(true);
    expect(readdirSync(join(dir, 'node_modules', '.scamp'))).toEqual([]);
  });

  it('ships no JavaScript on a static route whose views declare no events', () => {
    const html = readFileSync(join(dir, 'dist', 'index.html'), 'utf8');
    expect(html).toContain('data-scamp-id="root"');
    expect(html).not.toContain('<script');
    const links = [
      ...html.matchAll(
        /<link rel="stylesheet" href="(\/assets\/[^"]+\.css)">/g,
      ),
    ].map((m) => m[1] ?? '');
    expect(links.length).toBeGreaterThan(0);
    // Every linked sheet, in link order: the theme first, then the view's
    // module with its hashed class, which may sit in a chunk shared with
    // the other routes that render Home.
    const text = links
      .map((href) => readFileSync(join(dir, 'dist', href.slice(1)), 'utf8'))
      .join('\n');
    const cls = /class="([^" ]+)/.exec(html)?.[1] ?? '';
    expect(cls).not.toBe('');
    expect(text).toContain(`.${cls}`);
    expect(text.indexOf('--color-primary')).toBeGreaterThan(-1);
    expect(text.indexOf('--color-primary')).toBeLessThan(
      text.indexOf(`.${cls}`),
    );
  });

  it('runs load() at build time with env from .dev.vars and a real Request', () => {
    const html = readFileSync(join(dir, 'dist', 'about', 'index.html'), 'utf8');
    expect(html).toContain('built at /about');
    expect(html).not.toContain('<script');
  });

  it('hydrates a static route whose view declares an event, without load() in the browser bundle', () => {
    const html = readFileSync(join(dir, 'dist', 'play', 'index.html'), 'utf8');
    expect(html).toContain('Pressed 0');
    expect(html).toContain('<script id="scamp-data" type="application/json">');
    const src = /<script type="module" src="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(src).toMatch(/^\/assets\/.+\.js$/);
    const js = readFileSync(join(dir, 'dist', src.slice(1)), 'utf8');
    expect(js).toContain('scamp-root');
  });

  it("drops load() and its imports from a hydrated route's browser bundle", async () => {
    const other = scaffold('build-treeshake', {
      'lib/secret.ts':
        "export const SECRET_MARKER = 'server-only-' + 'marker';\nexport const fetchSecret = () => SECRET_MARKER;\n",
      'views/Button/Button.tsx': BUTTON_VIEW,
      'views/Button/Button.module.css': '.root {\n  padding: 8px;\n}\n',
      'routes/index.tsx': `import Button from '@/views/Button/Button';
import { fetchSecret } from '@/lib/secret';
import type { RouteProps } from 'scampjs/runtime';

export function load() {
  return { secret: fetchSecret() };
}

export default function Index({ data }: RouteProps<typeof load>) {
  return <Button label={data.secret.length > 0 ? 'ok' : 'no'} onPress={() => {}} />;
}
`,
    });
    try {
      await buildProject({ root: other, stderr: quiet });
      const html = readFileSync(join(other, 'dist', 'index.html'), 'utf8');
      expect(html).toContain('>ok<');
      const bundles = walk(join(other, 'dist')).filter((f) =>
        f.endsWith('.js'),
      );
      expect(bundles.length).toBeGreaterThan(0);
      for (const file of bundles) {
        expect(readFileSync(join(other, 'dist', file), 'utf8')).not.toContain(
          'server-only-',
        );
      }
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  }, 120_000);

  it('hydrates a client route', () => {
    const html = readFileSync(join(dir, 'dist', 'app', 'index.html'), 'utf8');
    expect(html).toContain('scamp-data');
    expect(html).toMatch(/<script type="module" src="\/assets\/[^"]+\.js">/);
  });

  it('renders params() pages with useParams() on the server', () => {
    expect(
      readFileSync(join(dir, 'dist', 'team', 'alpha', 'index.html'), 'utf8'),
    ).toContain('ALPHA (alpha)');
    expect(
      readFileSync(join(dir, 'dist', 'team', 'beta', 'index.html'), 'utf8'),
    ).toContain('BETA (beta)');
  });

  it('serves the folder as a static host would', async () => {
    const server = await createPreviewServer({ dir: join(dir, 'dist') });
    try {
      const home = await fetch(`${server.url}/`);
      expect(home.status).toBe(200);
      expect(home.headers.get('content-type')).toContain('text/html');
      expect(await home.text()).toContain('data-scamp-id="root"');
      expect((await fetch(`${server.url}/about`)).status).toBe(200);
      expect((await fetch(`${server.url}/about/`)).status).toBe(200);
      expect((await fetch(`${server.url}/team/beta`)).status).toBe(200);
      expect(
        (await fetch(`${server.url}/robots.txt`)).headers.get('content-type'),
      ).toContain('text/plain');
      expect((await fetch(`${server.url}/nope`)).status).toBe(404);
      expect((await fetch(`${server.url}/../package.json`)).status).toBe(404);
    } finally {
      await server.close();
    }
  });
});

describe('scamp build refuses what the static adapter cannot serve', () => {
  it('names a server route and a dynamic route without params(), and writes nothing', async () => {
    const dir = scaffold('build-refuse', {
      'routes/account.tsx':
        "import Home from '@/views/Home/Home';\nexport const render = 'server';\nexport default function A() { return <Home />; }\n",
      'routes/game/[token].tsx':
        "import Home from '@/views/Home/Home';\nexport function load() { return {}; }\nexport default function G() { return <Home />; }\n",
    });
    try {
      const failure = await buildProject({ root: dir, stderr: quiet }).then(
        () => null,
        (err: unknown) => err,
      );
      expect(failure).toBeInstanceOf(BuildError);
      const message = failure instanceof Error ? failure.message : '';
      expect(message).toContain('routes/account.tsx');
      expect(message).toContain('adapter');
      expect(message).toContain('routes/game/[token].tsx');
      expect(message).toContain('params()');
      expect(existsSync(join(dir, 'dist'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

describe('resolveStatic', () => {
  it('never escapes the folder', () => {
    expect(resolveStatic('/srv/dist', '/../etc/passwd')).toBeNull();
    expect(resolveStatic('/srv/dist', '/%2e%2e/etc/passwd')).toBeNull();
    expect(resolveStatic('/srv/dist', '/%E0%A4%A')).toBeNull();
  });
});
