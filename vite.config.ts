import { defineConfig } from 'vitest/config';

// GitHub Pages serves the app from /<repo-name>/.
export default defineConfig({
  base: '/phys-activity-tracking-app/',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
    },
  },
});
