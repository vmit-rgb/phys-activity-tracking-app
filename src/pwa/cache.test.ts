import { describe, expect, it } from 'vitest';
import { cacheName, fillWorker, precacheList, servesFromCache, staleCaches } from './cache';

describe('precacheList', () => {
  it('keeps the start page, the built and the static files, sorted', () => {
    expect(precacheList(
      ['index.html', 'assets/app-1.js', 'assets/app-1.css', 'sw.js'],
      ['fonts/noto.woff2', 'manifest.webmanifest'],
    )).toEqual(['./', 'assets/app-1.css', 'assets/app-1.js', 'fonts/noto.woff2', 'manifest.webmanifest']);
  });

  it('leaves out the component sheet, source maps and duplicates', () => {
    expect(precacheList(
      ['components.html', 'assets/components-9.js', 'assets/app-1.js', 'assets/app-1.js.map', 'assets/toast-2.js'],
      ['assets/app-1.js'],
    )).toEqual(['./', 'assets/app-1.js', 'assets/toast-2.js']);
  });
});

describe('caches by version', () => {
  it('names the cache after the version', () => {
    expect(cacheName('abc')).toBe('tracker-abc');
  });

  it('finds the older versions only, never caches of other code', () => {
    expect(staleCaches(['tracker-old', 'tracker-abc', 'something-else'], 'abc')).toEqual(['tracker-old']);
  });
});

describe('servesFromCache', () => {
  const scope = 'https://vmit-rgb.github.io/phys-activity-tracking-app/';
  it('answers the app’s own reads', () => {
    expect(servesFromCache({ method: 'GET', url: `${scope}assets/app-1.js` }, scope)).toBe(true);
  });
  it('leaves other sites and other methods to the network', () => {
    expect(servesFromCache({ method: 'GET', url: 'https://vmit-rgb.github.io/other/' }, scope)).toBe(false);
    expect(servesFromCache({ method: 'POST', url: scope }, scope)).toBe(false);
  });
});

describe('fillWorker', () => {
  it('fills every placeholder, however often it appears', () => {
    expect(fillWorker('a(__VERSION__);b(__PRECACHE__);c(__VERSION__)', ['./'], 'abc'))
      .toBe('a("abc");b(["./"]);c("abc")');
  });
  it('stops the build when an unknown placeholder is left', () => {
    expect(() => fillWorker('x(__SCOPE__)', [], 'abc')).toThrow('placeholder');
  });
});
