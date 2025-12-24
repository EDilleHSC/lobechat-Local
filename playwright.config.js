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
  // NAVI server is started automatically by Playwright when needed (CI-safe).
  // Playwright will reuse an existing server when present.
  webServer: {
    reuseExistingServer: true,
    // Start presenter + NAVI via the wrapper script for CI and reproducible testing
    command: 'node scripts/start_test_servers.js',
    // Wait for presenter (now started on 8006 by test wrapper)
    port: 8006,
    timeout: 60 * 1000,
    env: { WRITE_PORT_FILE: '1', FAIL_ON_PORT_CONFLICT: '1' },
  },
  // Fast fail if NAVI isn't running: perform a health check in globalSetup
  globalSetup: require.resolve('./tests/global-setup.js'),
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});