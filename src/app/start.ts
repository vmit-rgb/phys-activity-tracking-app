export type Platform = 'android' | 'iphone' | 'unknown';

export interface DeviceHints {
  userAgent: string;
  maxTouchPoints: number;
}

/**
 * Guesses the phone from what the browser reports (same rule as the
 * landing page). iPads on iPadOS 13+ say they are a Mac; the touch screen
 * gives them away, and their steps are the iPhone's.
 */
export function detectPlatform({ userAgent, maxTouchPoints }: DeviceHints): Platform {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iphone';
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'iphone';
  return 'unknown';
}

/** Opened from the home screen: the standard display mode, or Safari's own flag. */
export function isInstalled(
  matchMedia: (query: string) => { matches: boolean },
  navigator: { standalone?: boolean },
): boolean {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export type StartScreen = 'home' | 'install-first' | 'first-launch';

export interface StartFacts {
  hasDiary: boolean;
  installed: boolean;
  platform: Platform;
  /** «подивитися тут, без встановлення» was chosen earlier */
  browserChosen: boolean;
}

/**
 * Which screen the app opens on (Olesia, 2026-11-09): a phone in the browser
 * is asked to install first, with a quiet way to go on; a computer goes
 * straight to the first screen.
 */
export function startScreen({ hasDiary, installed, platform, browserChosen }: StartFacts): StartScreen {
  if (hasDiary) return 'home';
  const phoneInBrowser = !installed && platform !== 'unknown';
  return phoneInBrowser && !browserChosen ? 'install-first' : 'first-launch';
}
