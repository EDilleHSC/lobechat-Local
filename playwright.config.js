const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8005',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
  },
  // Start a lightweight static server in CI so tests can run without manual setup
  webServer: {
    command: 'npx http-server . -p 8005 -c-1',
    url: 'http://localhost:8005/presenter/design-approval.html',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});