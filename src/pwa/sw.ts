import { cacheName, servesFromCache, staleCaches } from './cache';

/*
 * The service worker: keeps the app working offline. Built to /sw.js; the
 * build replaces the two placeholders below (vite.config.ts). A new version
 * waits until the person taps «оновити» in the toast, so a screen never
 * changes under their fingers.
 */

declare const __PRECACHE__: string[];
declare const __VERSION__: string;

// The few worker types used here; the project's DOM types don't include them.
interface ExtendableEvent extends Event { waitUntil(promise: Promise<unknown>): void }
interface FetchEvent extends Event { readonly request: Request; respondWith(response: Promise<Response>): void }
interface MessageEvent extends Event { readonly data: unknown }
interface WorkerScope {
  readonly registration: { readonly scope: string };
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

const worker = self as unknown as WorkerScope;
const VERSION = __VERSION__;
const CACHE = cacheName(VERSION);
const START_PAGE = new URL('./', worker.registration.scope).href;

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(__PRECACHE__)));
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(staleCaches(names, VERSION).map((name) => caches.delete(name)))));
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!servesFromCache(request, worker.registration.scope)) return;
  const key = request.mode === 'navigate' ? START_PAGE : request;
  event.respondWith(caches.match(key, { ignoreSearch: true }).then((cached) => cached ?? fetch(request)));
});

worker.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void worker.skipWaiting();
});
