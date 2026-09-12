import { describe, expect, it } from 'vitest';
import { documentShell, escapeHtml } from '../src/dev/shell.js';

describe('documentShell', () => {
  it('puts the theme first, the body in #scamp-root, and scripts last', () => {
    const html = documentShell({
      title: 'Lobby',
      styles: ['body{margin:0}', '.root{width:100%}'],
      body: '<div>hi</div>',
      scripts: ['/@vite/client'],
    });
    expect(html.startsWith('<!doctype html>\n<html lang="en">')).toBe(true);
    expect(html.indexOf('<style>body{margin:0}</style>')).toBeLessThan(
      html.indexOf('<style>.root{width:100%}</style>'),
    );
    expect(html).toContain('<div id="scamp-root"><div>hi</div></div>');
    expect(html).toContain(
      '<script type="module" src="/@vite/client"></script>',
    );
    expect(html).not.toContain('scamp-data');
  });

  it('escapes the title and guards the data block against </script', () => {
    const html = documentShell({
      title: '<b>&"x"',
      styles: [],
      body: '',
      data: JSON.stringify({ s: '</script><script>alert(1)' }),
    });
    expect(html).toContain('<title>&lt;b&gt;&amp;&quot;x&quot;</title>');
    expect(html).toContain('<script id="scamp-data" type="application/json">');
    expect(html).not.toContain('</script><script>alert');
    expect(html).toContain('\\u003c/script>');
  });

  it('escapeHtml handles the four characters', () => {
    expect(escapeHtml('a<b>&"c"')).toBe('a&lt;b&gt;&amp;&quot;c&quot;');
  });
});
