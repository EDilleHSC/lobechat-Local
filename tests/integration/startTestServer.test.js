const path = require('path');
const { startTestServer } = require('../helpers/startTestServer');

describe('startTestServer safety guards', () => {
  test('refuses to run against non-test NAVI_ROOT', async () => {
    const orig = process.env.NAVI_ROOT;
    try {
      process.env.NAVI_ROOT = path.resolve(__dirname, '../../');
      await expect(startTestServer({ timeoutMs: 1000 })).rejects.toThrow(/Refusing to run tests against non-test NAVI_ROOT/);
    } finally {
      process.env.NAVI_ROOT = orig;
    }
  });
});
