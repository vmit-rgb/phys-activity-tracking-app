import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { precacheList } from './src/pwa/cache';

const PUBLIC_DIR = 'public';

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(PUBLIC_DIR, join(entry.parentPath, entry.name)).split(sep).join('/'));
}

/**
 * Writes the offline file list and a version into sw.js. The version is a
 * hash of every file it caches, so any change makes a new worker, and the
 * app then offers «є нова версія :)».
 */
function serviceWorkerManifest(): Plugin {
  return {
    name: 'service-worker-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const worker = bundle['sw.js'];
      if (worker?.type !== 'chunk') throw new Error('sw.js is missing from the build');
      const staticFiles = filesIn(PUBLIC_DIR);
      const list = precacheList(Object.keys(bundle), staticFiles);
      const hash = createHash('sha256').update(list.join('\n'));
      for (const file of staticFiles) hash.update(readFileSync(join(PUBLIC_DIR, file)));
      worker.code = worker.code
        .replaceAll('__PRECACHE__', JSON.stringify(list))
        .replaceAll('__VERSION__', JSON.stringify(hash.digest('hex').slice(0, 12)));
      if (/__[A-Z]+__/.test(worker.code)) throw new Error('sw.js still has a placeholder');
    },
  };
}

// GitHub Pages serves the app from /<repo-name>/.
export default defineConfig({
  base: '/phys-activity-tracking-app/',
  plugins: [serviceWorkerManifest()],
  build: {
    // older phones too: iOS 15.4+ (iPhone 6s and newer), Chrome 105+
    target: ['safari15.4', 'chrome105', 'firefox110'],
    sourcemap: false,
    rollupOptions: {
      // components.html: the living component sheet, to check the build on a phone
      input: {
        app: 'index.html',
        components: 'components.html',
        sw: 'src/pwa/sw.ts',
      },
      output: {
        // the worker keeps a fixed name next to the page, so its scope is the whole app
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // tokens.css is read as text by a test; other CSS stays out of the tests
    css: { include: [/\/tokens\.css/] },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/components-page.ts', 'src/pwa/sw.ts'],
    },
  },
});
