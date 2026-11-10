import { beforeEach, describe, expect, it } from 'vitest';
import tokens from '../styles/tokens.css?raw';
import { ACCENTS } from '../domain/accents';
import { DEFAULT_APPEARANCE, lookOf, startAppearance, type SystemTheme } from './appearance';

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
      expect(body, `${accent} ${theme}`).toMatch(/--accent-rgb: \d{1,3} \d{1,3} \d{1,3};/);
      for (const name of ['--accent-mid', '--accent-quiet', '--muted']) {
        expect(body, `${accent} ${theme}`).toMatch(new RegExp(`${name}: #[0-9a-f]{6};`));
      }
    }
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
