import { DEFAULT_ACCENT, type Accent } from '../domain/accents';

/** 'system' follows the phone; the other two are a fixed choice. */
export type Theme = 'system' | 'dark' | 'light';

/** How the app looks: the accent and the accessibility options of the profile. */
export interface Appearance {
  readonly accent: Accent;
  readonly theme: Theme;
  /** «збільшити розмір тексту»: all text × 1.2 */
  readonly largerText: boolean;
  /** «збільшені зони тапу»: 56 px instead of 48 */
  readonly largerTargets: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  accent: DEFAULT_ACCENT,
  theme: 'system',
  largerText: false,
  largerTargets: false,
};

/** Writes the appearance onto the root element; tokens.css does the rest. */
export function applyAppearance(root: HTMLElement, appearance: Appearance): void {
  root.dataset.accent = appearance.accent;
  if (appearance.theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = appearance.theme;
  root.toggleAttribute('data-larger-text', appearance.largerText);
  root.toggleAttribute('data-larger-targets', appearance.largerTargets);
}
