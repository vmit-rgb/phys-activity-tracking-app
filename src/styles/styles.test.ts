import { describe, expect, it } from 'vitest';
import main from '../main.ts?raw';
import calendar from './calendar.css?raw';
import base from './base.css?raw';
import components from './components.css?raw';
import index from '../../index.html?raw';
import history from './history.css?raw';
import settings from './settings.css?raw';
import home from './home.css?raw';
import sections from './sections.css?raw';
import tokens from './tokens.css?raw';
import typography from './typography.css?raw';

// The cascade can't be seen in jsdom, so these read the stylesheets as text (comments stripped).
const FILES: Record<string, string> = { './base.css': base, '../main.ts': main, './calendar.css': calendar, './components.css': components, './history.css': history, './settings.css': settings, './home.css': home, './sections.css': sections, './tokens.css': tokens, './typography.css': typography };
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

  it('draw home as Figma: stat cards, sheet, saved slider, past-day date, left buttons (п. 14, 19–22, Н6)', () => {
    const calendar = read('./calendar.css');
    // 4 cards go 2 × 2 (Olesia, 2026-11-11); number and «з N днів» on one line
    expect(calendar).toMatch(/\.stats:has\(> :nth-child\(4\)\) \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(block(calendar, '.stat__value')).toContain('align-items: baseline;');
    expect(block(calendar, '.cal-sheet__panel')).not.toContain('border-top');
    const sections = read('./sections.css');
    expect(sections).toMatch(/\.slider:disabled::-webkit-slider-thumb \{[^}]*width: 8px;[^}]*background: var\(--disabled\);/);
    expect(sections).toMatch(/\[data-act='drop'\][^{]*\{[^}]*align-self: flex-start;/);
    expect(sections).toMatch(/\.acc-body--group > \.btn--tertiary \{[^}]*align-self: flex-start;/);
    expect(read('./home.css')).toMatch(/\.hero__text--past b \{[^}]*font-weight: 700;/);
    expect(block(read('./components.css'), '.unit')).toMatch(/color: var\(--muted\);[^}]*font-size: calc\(12px \* var\(--text-scale\)\);/);
  });

  it('draw the history, search, tabs and the full-screen field as Figma (п. 6, 7, 23, 24, 26, Н10)', () => {
    const history = read('./history.css');
    expect(block(history, '.history__days')).toContain('gap: 0;');
    expect(history).toMatch(/\.day-card \+ \.day-card \{[^}]*border-top: 0;/);
    expect(block(history, '.avgs--column')).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(block(history, '.value-row')).toContain('display: block;');
    expect(block(history, ".bar__search[aria-pressed='true']")).not.toContain('background');
    expect(block(history, '.search')).toContain('bottom: calc(var(--bar-h) + 8px + env(safe-area-inset-bottom));');
    const components = read('./components.css');
    // the tab you can switch to is underlined; the chosen one is not (Olesia, В 35)
    expect(components).toMatch(/\.tab:is\(\[aria-selected='true'\], \[aria-pressed='true'\]\) \{[^}]*text-decoration: none;/);
    // a pressed level keeps a 1 px muted frame (accordion/trigger group pressed)
    expect(block(components, '.accordion--group')).toContain('--ring-w-pressed: var(--stroke-3);');
    expect(block(components, '.ctl:active')).toContain('--ring-w: var(--ring-w-pressed, var(--ring-w-0, 0px));');
    expect(block(read('./settings.css'), '.text-edit')).toContain('background: var(--bg);');
  });

  it('drop the browser’s button padding and keep 8 px inside the settings boxes (п. 27, 32)', () => {
    expect(block(read('./components.css'), '.ctl')).toContain('padding: 0;');
    expect(read('./settings.css')).toMatch(/\.st-item\.st-box \{[^}]*padding: 4px 8px 8px;/);
  });

  it('draw the noise as overlay/noise: light grain SCREEN and dark grain MULTIPLY, 25 % each (Н11)', () => {
    const base = read('./base.css');
    expect(block(base, '.noise')).toMatch(/opacity: 0.25;[^}]*mix-blend-mode: screen;/);
    expect(block(base, '.noise--dark')).toContain('mix-blend-mode: multiply;');
    expect(index.match(/class="noise[^"]*"/g)).toEqual(['class="noise"', 'class="noise noise--dark"']);
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
