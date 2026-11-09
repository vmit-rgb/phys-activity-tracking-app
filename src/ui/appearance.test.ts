import { beforeEach, describe, expect, it } from 'vitest';
import tokens from '../styles/tokens.css?raw';
import { ACCENTS } from '../domain/accents';
import { DEFAULT_APPEARANCE, applyAppearance } from './appearance';

describe('applyAppearance', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('html');
  });

  it('starts with pink, the phone theme, normal text and normal tap targets', () => {
    applyAppearance(root, DEFAULT_APPEARANCE);
    expect(root.dataset.accent).toBe('pink');
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(root.hasAttribute('data-larger-text')).toBe(false);
    expect(root.hasAttribute('data-larger-targets')).toBe(false);
  });

  it('applies a chosen accent, a fixed theme and both accessibility options', () => {
    applyAppearance(root, { accent: 'cyan', theme: 'light', largerText: true, largerTargets: true });
    expect(root.dataset.accent).toBe('cyan');
    expect(root.dataset.theme).toBe('light');
    expect(root.hasAttribute('data-larger-text')).toBe(true);
    expect(root.hasAttribute('data-larger-targets')).toBe(true);
  });

  it('goes back to the phone theme and normal sizes when the options are switched off', () => {
    applyAppearance(root, { accent: 'mint', theme: 'dark', largerText: true, largerTargets: true });
    applyAppearance(root, DEFAULT_APPEARANCE);
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(root.hasAttribute('data-larger-text')).toBe(false);
    expect(root.hasAttribute('data-larger-targets')).toBe(false);
  });
});

describe('accent tokens', () => {
  it.each(ACCENTS)('defines every shade of %s for both themes', (accent) => {
    const block = new RegExp(`\\[data-accent='${accent}'\\][^{]*\\{([^}]*)\\}`).exec(tokens);
    expect(block, accent).not.toBeNull();
    for (const name of ['--accent', '--accent-mid', '--accent-quiet', '--muted']) {
      expect(block![1]).toMatch(new RegExp(`${name}: light-dark\\(#[0-9a-f]{6}, #[0-9a-f]{6}\\);`));
    }
  });
});
