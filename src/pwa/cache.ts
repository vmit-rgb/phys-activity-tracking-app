/*
 * What the service worker keeps for offline use. Pure, so the build (which
 * writes the list) and the worker (which uses it) share one decision.
 */

const PREFIX = 'tracker-';

/** Files that belong only to the component sheet stay out of the app's offline copy. */
function belongsToApp(file: string): boolean {
  return !file.startsWith('components') && !file.startsWith('assets/components-') && !file.endsWith('.map');
}

/**
 * Everything the app needs offline, relative to the worker: the start page
 * as `./`, the built files and the static ones (fonts, icons, manifest).
 */
export function precacheList(builtFiles: readonly string[], staticFiles: readonly string[]): string[] {
  const files = [...builtFiles, ...staticFiles]
    .filter((file) => file !== 'sw.js' && file !== 'index.html' && belongsToApp(file))
    .sort();
  return ['./', ...new Set(files)];
}

export function cacheName(version: string): string {
  return `${PREFIX}${version}`;
}

/** Caches of older versions, to delete once the new version takes over. */
export function staleCaches(names: readonly string[], version: string): string[] {
  return names.filter((name) => name.startsWith(PREFIX) && name !== cacheName(version));
}

/** Only the app's own GET requests are answered from the cache. */
export function servesFromCache(request: { method: string; url: string }, scope: string): boolean {
  return request.method === 'GET' && request.url.startsWith(scope);
}
