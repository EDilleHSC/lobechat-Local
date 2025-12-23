const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { computeFileHash } = require('../../../tools/file_hash');

describe('file_hash utility', () => {
  const tmpDir = path.join(__dirname, 'tmp');

  before(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  });

  after(() => {
    // leave tmp files for inspection if needed; do a light cleanup
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  });

  it('computes sha256 for a small file', async () => {
    const file = path.join(tmpDir, 'small.txt');
    const content = 'hello world\n';
    fs.writeFileSync(file, content, 'utf8');

    const expected = crypto.createHash('sha256').update(content).digest('hex');
    const got = await computeFileHash(file);
    expect(got).to.equal(expected);
  });

  it('rejects with an error for missing file', async () => {
    const missing = path.join(tmpDir, 'no-such-file.txt');
    let threw = false;
    try {
      await computeFileHash(missing);
    } catch (err) {
      threw = true;
      expect(err).to.exist;
    }
    if (!threw) throw new Error('expected computeFileHash to throw for missing file');
  });
});
