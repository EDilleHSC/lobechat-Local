// playwright.config.js
module.exports = {
  timeout: 30 * 1000,
  use: {
    headless: true,
  },
  testDir: 'tests/e2e'
};