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
  // NAVI server is started manually.
  // Do NOT spawn a web server from Playwright — reuse the existing instance.
  webServer: {
    url: 'http://localhost:8005',
    reuseExistingServer: true,
  },
  // Fast fail if NAVI isn't running: perform a health check in globalSetup
  globalSetup: require.resolve('./ops/playwright_health_check.js'),
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});