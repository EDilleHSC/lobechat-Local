module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/unit/**/*.test.[jt]s?(x)'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  verbose: true,
};