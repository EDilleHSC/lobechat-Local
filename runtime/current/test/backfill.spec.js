const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getEntryByHash } = require('../../../tools/seen_files');
const { computeFileHash } = require('../../../tools/file_hash');

describe('backfill_seen_files script', function() {
  this.timeout(5000);
  const tmp = path.join(__dirname, 'tmp_backfill');
  const inbox = path.join(tmp, 'inbox');
  const sorted = path.join(tmp, 'sorted');

  before(() => {
    try { fs.rmSync(tmp, { recursive: true }); } catch (e) {}
    fs.mkdirSync(inbox, { recursive: true });
    fs.mkdirSync(sorted, { recursive: true });
  });

  after(() => {
    try { fs.rmSync(tmp, { recursive: true }); } catch (e) {}
  });

  it('appends missing entries to registry', () => {
    const f1 = path.join(inbox, 'a.pdf');
    const f2 = path.join(sorted, 'b.pdf');
    fs.writeFileSync(f1, 'alpha ' + Date.now());
    fs.writeFileSync(f2, 'beta ' + Date.now());

    // run the script pointing at tmp NAVI root
    const script = path.resolve(__dirname, '..', '..', '..', 'scripts', 'backfill_seen_files.js');
    execSync(`node "${script}" --navi-root "${tmp}"`, { encoding: 'utf8' });

    // confirm registry entries
    return computeFileHash(f1).then(h1 => {
      const e1 = getEntryByHash(h1);
      expect(e1).to.exist;
      return computeFileHash(f2).then(h2 => {
        const e2 = getEntryByHash(h2);
        expect(e2).to.exist;
      });
    });
  });
});
