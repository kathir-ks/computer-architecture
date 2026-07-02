import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the bundle works on GitHub Pages under any repo path.
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'jsdom',
  },
});
