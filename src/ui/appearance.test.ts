import { beforeEach, describe, expect, it } from 'vitest';
import tokens from '../styles/tokens.css?raw';
import settings from '../styles/settings.css?raw';
import { ACCENTS } from '../domain/accents';
import { DEFAULT_APPEARANCE, lookOf, startAppearance, type SystemTheme } from './appearance';

type Theme = 'dark' | 'light';
const THEMES: readonly Theme[] = ['dark', 'light'];
const THEME_BLOCK: Record<Theme, string> = { dark: ':root', light: ":root[data-theme='light']" };

/* WCAG 2 relative luminance and contrast; OKLCH hue (Björn Ottosson's matrices). */
type Rgb = readonly [number, number, number];
const linear = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const oklch = ([red, green, blue]: Rgb) => {
  const [r, g, b] = [linear(red), linear(green), linear(blue)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
};
const hueGap = (x: number, y: number) => {
  const d = Math.abs(x - y) % 360;
  return d > 180 ? 360 - d : d;
};

/** A phone whose theme can be switched in the test. */
function fakePhone(light: boolean) {
  const listeners: Array<() => void> = [];
  const media: SystemTheme = {
    matches: light,
    addEventListener: (_type, listener) => listeners.push(listener),
  };
  return {
    media,
    switchTo(nextLight: boolean) {
      media.matches = nextLight;
      for (const listener of listeners) listener();
    },
  };
}

describe('appearance', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('html');
  });

  it('starts with pink, the phone theme, normal text and normal tap targets', () => {
    startAppearance(root, fakePhone(false).media, DEFAULT_APPEARANCE);
    expect(root.dataset.accent).toBe('pink');
    expect(root.dataset.theme).toBe('dark');
    expect(root.hasAttribute('data-larger-text')).toBe(false);
    expect(root.hasAttribute('data-larger-targets')).toBe(false);
  });

  it('follows the phone when it switches between dark and light', () => {
    const phone = fakePhone(true);
    startAppearance(root, phone.media, DEFAULT_APPEARANCE);
    expect(root.dataset.theme).toBe('light');
    phone.switchTo(false);
    expect(root.dataset.theme).toBe('dark');
  });

  it('keeps a fixed theme whatever the phone does', () => {
    const phone = fakePhone(false);
    startAppearance(root, phone.media, { ...DEFAULT_APPEARANCE, theme: 'light' });
    phone.switchTo(false);
    expect(root.dataset.theme).toBe('light');
  });

  it('applies a new choice and both accessibility options', () => {
    const phone = fakePhone(false);
    const apply = startAppearance(root, phone.media, DEFAULT_APPEARANCE);
    apply({ ...DEFAULT_APPEARANCE, accent: 'cyan', largerText: true, largerTargets: true, noMotion: true, mirrored: true });
    expect(root.hasAttribute('data-no-motion')).toBe(true);
    expect(root.hasAttribute('data-mirrored')).toBe(true);
    expect(root.dataset.accent).toBe('cyan');
    expect(root.hasAttribute('data-larger-text')).toBe(true);
    expect(root.hasAttribute('data-larger-targets')).toBe(true);
    phone.switchTo(true);
    expect(root.dataset.theme).toBe('light');
    expect(root.dataset.accent).toBe('cyan');
  });

  it('turns the accessibility options off again', () => {
    const apply = startAppearance(root, fakePhone(false).media, { ...DEFAULT_APPEARANCE, largerText: true, largerTargets: true });
    apply(DEFAULT_APPEARANCE);
    expect(root.hasAttribute('data-larger-text')).toBe(false);
    expect(root.hasAttribute('data-larger-targets')).toBe(false);
  });
});

describe('accent tokens', () => {
  const shades = (selector: string) => {
    const block = new RegExp(`${selector.replace(/[[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(tokens);
    return block?.[1] ?? '';
  };

  it.each(ACCENTS)('defines every shade of %s for both themes', (accent) => {
    for (const theme of ['dark', 'light']) {
      const body = shades(`:root[data-theme='${theme}'][data-accent='${accent}']`);
      expect(body, `${accent} ${theme}`).toContain(`--accent-rgb: var(--rgb-${accent});`);
      for (const name of ['--accent-mid', '--accent-quiet', '--muted']) {
        expect(body, `${accent} ${theme}`).toMatch(new RegExp(`${name}: #[0-9a-f]{6};`));
      }
    }
  });

  // One place for each accent's colour: the theme blocks hold it, the picker's swatches read it.
  const rgbOf = (theme: Theme, accent: string): Rgb | null => {
    const found = new RegExp(`--rgb-${accent}: (\\d{1,3}) (\\d{1,3}) (\\d{1,3});`).exec(shades(THEME_BLOCK[theme]));
    return found ? [Number(found[1]), Number(found[2]), Number(found[3])] : null;
  };
  const hexOf = (theme: Theme, token: string): Rgb | null => {
    const found = new RegExp(`--${token}: #([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2});`).exec(shades(THEME_BLOCK[theme]));
    return found ? [parseInt(found[1]!, 16), parseInt(found[2]!, 16), parseInt(found[3]!, 16)] : null;
  };

  it.each(ACCENTS)('keeps the colour of %s in each theme block, for the accent and its swatch', (accent) => {
    expect(rgbOf('dark', accent)).not.toBeNull();
    expect(rgbOf('light', accent)).not.toBeNull();
    expect(settings).toContain(`.swatch[data-swatch='${accent}'] { --sw: rgb(var(--rgb-${accent})); }`);
  });

  it('has no colour for success: the accent stands for it (Olesia, 2026-11-12)', () => {
    expect(tokens).not.toMatch(/--ok:/);
  });

  // Olesia, 2026-11-12: every accent stays at least 35° of hue away from the error and warning colours.
  it.each(THEMES)('keeps every coloured accent 35° away from error and warning in the %s theme', (theme) => {
    for (const semantic of ['err', 'warn']) {
      const sem = oklch(hexOf(theme, semantic)!);
      for (const accent of ACCENTS.filter((a) => a !== 'gray')) {
        const acc = oklch(rgbOf(theme, accent)!);
        expect(hueGap(acc.h, sem.h), `${accent} vs ${semantic}`).toBeGreaterThanOrEqual(35);
      }
    }
  });

  it.each(THEMES)('passes AA for text on every accent and for error and warning text in the %s theme', (theme) => {
    const page = hexOf(theme, 'bg')!;
    const onAccent = hexOf(theme, 'on-accent')!;
    for (const accent of ACCENTS) expect(contrast(rgbOf(theme, accent)!, onAccent), accent).toBeGreaterThanOrEqual(4.5);
    for (const semantic of ['err', 'warn']) expect(contrast(hexOf(theme, semantic)!, page), semantic).toBeGreaterThanOrEqual(4.5);
  });

  it('needs nothing newer than iOS 15.4 for colours', () => {
    const code = tokens.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/light-dark\(|color-mix\(/);
  });
});

describe('lookOf', () => {
  it('takes the accent and the «доступність» switches from a profile', () => {
    expect(lookOf({ theme: { accent: 'mint' }, accessibility: { largerText: true, mirrored: true } })).toEqual({
      accent: 'mint', largerText: true, largerTargets: false, noMotion: false, mirrored: true,
    });
    const { theme: _theme, ...defaults } = DEFAULT_APPEARANCE;
    expect(lookOf({})).toEqual(defaults);
  });
});
