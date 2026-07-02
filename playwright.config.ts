import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    // Serves the built dist/ — run `npm run build` first (CI does).
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
