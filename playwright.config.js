import { defineConfig } from '@playwright/test';

// One smoke test per PLAN.md §7: loads the page, asserts the model appears.
// Skip WebGL pixel-diffing — high maintenance, low yield at this scale.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  webServer: {
    command: 'npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
    },
  },
});
