import { DEFAULT_ACCENT, type Accent } from '../domain/accents';
import type { JsonObject } from '../domain/diary';
import { readSettings } from '../domain/settings';

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
  /** «вимкнути всі анімації»: motion is instant, as with the phone's «reduce motion» */
  readonly noMotion: boolean;
  /** «віддзеркалити нижню панель»: ≡ on the right, the date on the left */
  readonly mirrored: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  accent: DEFAULT_ACCENT,
  theme: 'system',
  largerText: false,
  largerTargets: false,
  noMotion: false,
  mirrored: false,
};

/** What a profile says about the look; the theme belongs to the phone, not the profile. */
export function lookOf(profile: JsonObject): Omit<Appearance, 'theme'> {
  const { accent, accessibility: a } = readSettings(profile);
  return { accent, largerText: a.largerText, largerTargets: a.largerTargets, noMotion: a.noMotion, mirrored: a.mirrored };
}

/** The phone's light/dark setting: `matchMedia('(prefers-color-scheme: light)')`. */
export interface SystemTheme {
  matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
}

function apply(root: HTMLElement, appearance: Appearance, systemLight: boolean): void {
  const light = appearance.theme === 'system' ? systemLight : appearance.theme === 'light';
  root.dataset.theme = light ? 'light' : 'dark';
  root.dataset.accent = appearance.accent;
  root.toggleAttribute('data-larger-text', appearance.largerText);
  root.toggleAttribute('data-larger-targets', appearance.largerTargets);
  root.toggleAttribute('data-no-motion', appearance.noMotion);
  root.toggleAttribute('data-mirrored', appearance.mirrored);
}

/**
 * Writes the appearance onto the root element (tokens.css does the rest) and
 * keeps following the phone's theme. Returns a function that applies a new
 * appearance, e.g. after a change in settings.
 */
export function startAppearance(root: HTMLElement, system: SystemTheme, initial: Appearance): (next: Appearance) => void {
  let current = initial;
  system.addEventListener('change', () => apply(root, current, system.matches));
  apply(root, current, system.matches);
  return (next) => {
    current = next;
    apply(root, current, system.matches);
  };
}
