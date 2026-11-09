import { defineConfig } from 'vitest/config';

// GitHub Pages serves the app from /<repo-name>/.
export default defineConfig({
  base: '/phys-activity-tracking-app/',
  build: {
    // older phones too: iOS 15.4+ (iPhone 6s and newer), Chrome 105+
    target: ['safari15.4', 'chrome105', 'firefox110'],
    sourcemap: false,
    rollupOptions: {
      // components.html: the living component sheet, to check the build on a phone
      input: {
        app: 'index.html',
        components: 'components.html',
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
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/components-page.ts'],
    },
  },
});
