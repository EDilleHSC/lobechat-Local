const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { appendSeenEntry, readAllEntries, getEntryByHash, metadataDir, seenFilePath } = require('../../../tools/seen_files');

describe('seen_files registry', () => {
  const tmpRoot = path.join(__dirname, 'tmp_navi');

  before(() => {
    // Set NAVI_ROOT to a tmp path for isolation
    process.env.NAVI_ROOT = tmpRoot;
    // cleanup
    try { fs.rmSync(tmpRoot, { recursive: true }); } catch (e) {}
  });

  after(() => {
    try { fs.rmSync(tmpRoot, { recursive: true }); } catch (e) {}
    delete process.env.NAVI_ROOT;
  });

  it('creates metadata dir and can append/read entries', async () => {
    const entry1 = { hash: 'a1b2c3', path: 'NAVI/inbox/x.pdf', filename: 'x.pdf', first_seen: new Date().toISOString() };
    const entry2 = { hash: 'd4e5f6', path: 'NAVI/inbox/y.pdf', filename: 'y.pdf', first_seen: new Date().toISOString() };

    const dir = metadataDir();
    expect(dir).to.be.a('string');

    await appendSeenEntry(entry1);
    await appendSeenEntry(entry2);

    const all = readAllEntries();
    expect(all).to.be.an('array').with.lengthOf(2);
    expect(all[0].hash).to.equal(entry1.hash);
    expect(all[1].hash).to.equal(entry2.hash);

    const e = getEntryByHash('a1b2c3');
    expect(e).to.exist;
    expect(e.filename).to.equal('x.pdf');
  });

  it('getEntryByHash returns null for missing hash', () => {
    const e = getEntryByHash('nope');
    expect(e).to.equal(null);
  });
});
