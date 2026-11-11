import { describe, expect, it } from 'vitest';
import main from '../main.ts?raw';
import calendar from './calendar.css?raw';
import components from './components.css?raw';
import history from './history.css?raw';
import settings from './settings.css?raw';
import home from './home.css?raw';
import sections from './sections.css?raw';
import tokens from './tokens.css?raw';
import typography from './typography.css?raw';

// The cascade can't be seen in jsdom, so these read the stylesheets as text (comments stripped).
const FILES: Record<string, string> = { '../main.ts': main, './calendar.css': calendar, './components.css': components, './history.css': history, './settings.css': settings, './home.css': home, './sections.css': sections, './tokens.css': tokens, './typography.css': typography };
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

  it('show each field’s own Figma focus after a tap as after a key (Olesia, 2026-11-11, Н3)', () => {
    const css = read('./components.css');
    expect(css).not.toContain('data-modality');
    // number: accent brackets, line 2 px and unit at 900, no frame
    expect(block(css, '.number:focus-within')).toMatch(/--part: var\(--accent\);[^}]*--part-weight: 900;[^}]*--num-line: var\(--accent\);[^}]*--num-line-w: var\(--stroke-focus\);[^}]*--unit: var\(--accent\);[^}]*--unit-weight: 900;/);
    expect(block(css, '.number:focus-within')).not.toContain('box-shadow');
    // text: the ring
    expect(block(css, '.field:focus')).toContain('box-shadow: var(--focus-ring);');
  });

  it('draw the number field as input/base: line after the digits, unit inside, hover and error as Figma (п. 5)', () => {
    const css = read('./components.css');
    expect(block(css, '.number__input')).toMatch(/background-position: calc\(var\(--len, 0\) \* 1ch\) 100%;/);
    expect(block(css, '.number__input')).toMatch(/width: calc\(max\(var\(--chars\), var\(--len, 0\) \+ 1\) \* 1ch\);/);
    expect(block(css, '.number')).not.toMatch(/\bwidth: 180px/);
    expect(css).toMatch(/\.number:hover \{[^}]*--part: var\(--accent\);[^}]*--part-weight: 700;[^}]*--unit-weight: 700;/);
    expect(css).not.toMatch(/\.number:hover \{[^}]*--num-line: var\(--accent\)/);
    // an error keeps the unit muted
    expect(block(css, ".number:has([aria-invalid='true'])")).not.toContain('--unit');
  });

  it('give the checkbox Figma’s hover and focus: accent 720 / 900, no frame (п. 5а)', () => {
    const css = read('./components.css');
    expect(block(css, '.checkbox')).toMatch(/--fg-hover: var\(--accent\);[^}]*--weight-hover: 720;/);
    expect(css).not.toContain('.checkbox__input:focus-visible + .checkbox__box');
    expect(block(css, '.checkbox:has(.checkbox__input:focus-visible)')).toMatch(/--fg-0: var\(--accent\);[^}]*--weight-0: 900;/);
  });

  it('make every control at least --tap wide and high (Н9, ACCESSIBILITY.md rule 1)', () => {
    expect(block(read('./components.css'), '.ctl')).toMatch(/min-width: var\(--tap\);[^}]*min-height: var\(--tap\);/);
    // no smaller fixed sizes on a tap target
    expect(block(read('./settings.css'), '.st-text--link')).not.toMatch(/min-height/);
    expect(read('./history.css')).not.toMatch(/min-(height|width): (32|44)px/);
    expect(block(read('./history.css'), '.search__input')).toContain('min-height: var(--tap);');
    // the day of the month is a target too
    expect(block(read('./calendar.css'), '.cal-day')).toContain('min-height: var(--tap);');
    expect(read('./calendar.css')).toMatch(/grid-template-columns: repeat\(7, minmax\(var\(--tap\), 1fr\)\);/);
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
