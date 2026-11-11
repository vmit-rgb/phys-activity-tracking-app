import { describe, expect, it } from 'vitest';
import main from '../main.ts?raw';
import components from './components.css?raw';
import home from './home.css?raw';
import sections from './sections.css?raw';
import tokens from './tokens.css?raw';
import typography from './typography.css?raw';

// The cascade can't be seen in jsdom, so these read the stylesheets as text (comments stripped).
const FILES: Record<string, string> = { '../main.ts': main, './components.css': components, './home.css': home, './sections.css': sections, './tokens.css': tokens, './typography.css': typography };
const read = (file: string) => FILES[file]!.replace(/\/\*[\s\S]*?\*\//g, '');
const block = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? undefined : css.slice(at, css.indexOf('}', at));
};

describe('stylesheets', () => {
  it('load the text styles last, so a later font rule can’t beat a t-* class', () => {
    const imports = [...read('../main.ts').matchAll(/import '\.\/styles\/([\w-]+\.css)'/g)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(5);
    expect(imports.at(-1)).toBe('typography.css');
  });

  it('let a control with a text style keep its own weight for hover and pressed', () => {
    const css = read('./typography.css');
    for (const [style, weight] of [['t-h5', 500], ['t-1st-semibold', 600], ['t-3rd-regular', 420], ['t-2nd-bold', 720]] as const)
      expect(css).toMatch(new RegExp(`\\.${style}[^{]*\\{[^}]*--weight-0: ${weight};`));
    const rule = /\.ctl:is\(([^)]*)\) \{ font-weight: var\(--weight\); \}/.exec(css);
    expect(rule![1]!.split(', ')).toHaveLength(15);
  });

  it('keep the heading margin reset weaker than any class', () => {
    expect(read('./typography.css')).toMatch(/:where\(\.t-h1, \.t-h2, \.t-h3, \.t-h4, \.t-h5, \.t-h6\) \{ margin: 0; \}/);
  });

  it('let the bar grow with larger text when the date doesn’t fit beside ≡ (Olesia, 2026-11-11)', () => {
    const home = read('./home.css');
    expect(home).toMatch(/@media \(max-width: 540px\) \{\s*:root\[data-larger-text\] \.bar:has\(> \.bar__right\) \{[^}]*grid-template-areas: 'menu goal' 'nav nav';/);
    expect(read('./tokens.css')).toMatch(/@media \(max-width: 540px\) \{\s*:root\[data-larger-text\] \{\s*--bar-h: calc\(83px \+ var\(--tap\)\);/);
    // what sits above the bar follows its height
    expect(read('./components.css')).toContain('bottom: calc(var(--bar-h) + max(8px, env(safe-area-inset-bottom)));');
    expect(home).toContain('bottom: calc(var(--bar-h) + 16px + env(safe-area-inset-bottom));');
  });

  it('draw × for removing in the accent colour, not the error colour (Н4)', () => {
    const css = read('./sections.css');
    expect(block(css, '.rm')).toBeUndefined();
    expect(css).not.toMatch(/\.rm[^{]*\{[^}]*--err/);
  });

  it('drop the hover pill while a text button is pressed (Н12)', () => {
    const css = read('./components.css');
    expect(css).toMatch(/\.btn--tertiary:not\(:disabled, \[aria-disabled='true'\], :active\):hover::after/);
    expect(css).toMatch(/\.btn--destructive:not\(:disabled, \[aria-disabled='true'\], :active\):hover::after/);
  });
});
