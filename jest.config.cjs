module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/unit/**/*.test.[jt]s?(x)','<rootDir>/tests/integration/**/*.test.[jt]s?(x)'],
  // Ignore legacy or imported test sets that live under `import/` to avoid running
  // stale tests that reference a different repo layout in CI environments.
  testPathIgnorePatterns: ['<rootDir>/import/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  verbose: true,
};