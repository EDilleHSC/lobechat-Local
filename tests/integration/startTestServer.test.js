const path = require('path');
const { startTestServer } = require('../helpers/startTestServer');

describe('startTestServer safety guards', () => {
  test('refuses to run against non-test NAVI_ROOT when TEST_SERVER_STRICT=1', async () => {
    const origRoot = process.env.NAVI_ROOT;
    const origStrict = process.env.TEST_SERVER_STRICT;
    try {
      // enable strict mode and set a non-test NAVI root
      process.env.TEST_SERVER_STRICT = '1';
      process.env.NAVI_ROOT = path.resolve(__dirname, '../../');
      await expect(startTestServer({ timeoutMs: 1000 })).rejects.toThrow(/Refusing to run tests against non-test NAVI_ROOT/);
    } finally {
      process.env.NAVI_ROOT = origRoot;
      process.env.TEST_SERVER_STRICT = origStrict;
    }
  });
});
