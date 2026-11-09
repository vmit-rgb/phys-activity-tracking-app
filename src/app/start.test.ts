import { describe, expect, it } from 'vitest';
import { detectPlatform, isInstalled, startScreen, type StartFacts } from './start';

describe('detectPlatform', () => {
  it.each([
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129.0 Mobile', 0, 'android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1', 5, 'iphone'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 5, 'iphone'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 0, 'unknown'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0', 0, 'unknown'],
  ])('%s with %i touch points → %s', (userAgent, maxTouchPoints, platform) => {
    expect(detectPlatform({ userAgent, maxTouchPoints })).toBe(platform);
  });
});

describe('isInstalled', () => {
  const display = (standalone: boolean) => (query: string) => ({ matches: standalone && query === '(display-mode: standalone)' });
  it('is true when opened from the home screen', () => {
    expect(isInstalled(display(true), {})).toBe(true);
    expect(isInstalled(display(false), { standalone: true })).toBe(true);
  });
  it('is false in a browser tab', () => {
    expect(isInstalled(display(false), {})).toBe(false);
    expect(isInstalled(display(false), { standalone: false })).toBe(false);
  });
});

describe('startScreen', () => {
  const facts = (over: Partial<StartFacts>): StartFacts => ({
    hasDiary: false, installed: false, platform: 'android', browserChosen: false, ...over,
  });

  it('opens home when the diary is already set up', () => {
    expect(startScreen(facts({ hasDiary: true }))).toBe('home');
  });
  it('asks a phone in the browser to install first', () => {
    expect(startScreen(facts({ platform: 'android' }))).toBe('install-first');
    expect(startScreen(facts({ platform: 'iphone' }))).toBe('install-first');
  });
  it('lets a phone in the browser through once the person chose that', () => {
    expect(startScreen(facts({ browserChosen: true }))).toBe('first-launch');
  });
  it('lets a computer through, so a recruiter can look around', () => {
    expect(startScreen(facts({ platform: 'unknown' }))).toBe('first-launch');
  });
  it('starts the installed app on the first screen', () => {
    expect(startScreen(facts({ installed: true }))).toBe('first-launch');
  });
});
