const { expect } = require('chai');
const fs = require('fs');
const fsSync = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { computeFileHash } = require('../../../tools/file_hash');

describe('router dedupe integration', function() {
  this.timeout(5000);
  const tmp = path.join(__dirname, 'tmp_router_dedupe');
  const navRoot = tmp;
  const inbox = path.join(tmp, 'inbox');

  before(() => {
    try { fs.rmSync(tmp, { recursive: true }); } catch (e) {}
    fs.mkdirSync(inbox, { recursive: true });
  });

  after(() => {
    try { fs.rmSync(tmp, { recursive: true }); } catch (e) {}
  });

  it('detects duplicate content and marks sidecar', () => {
    // create two files with same content
    const content = 'UniqueDupContent ' + Date.now();
    const f1 = path.join(inbox, 'dup1.pdf');
    const f2 = path.join(inbox, 'dup2.pdf');
    fs.writeFileSync(f1, content);
    fs.writeFileSync(f2, content);

    // run router.js in runtime/current with NAVI_ROOT overridden to tmp
    const cwd = path.join(__dirname, '..'); // runtime/current
    const r = spawnSync('node', ['router.js', '--dry-run'], { cwd, env: Object.assign({}, process.env, { NAVI_ROOT: navRoot }), encoding: 'utf8', maxBuffer: 10*1024*1024 });
    expect(r.status).to.equal(0);
    // parse output JSON
    const out = JSON.parse(r.stdout);
    expect(out).to.have.property('routed_files');
    expect(out.routed_files).to.have.lengthOf(2);

    // read sidecars
    const sc1 = JSON.parse(fs.readFileSync(f1 + '.navi.json','utf8'));
    const sc2 = JSON.parse(fs.readFileSync(f2 + '.navi.json','utf8'));

    // compute expected hash
    return computeFileHash(f1).then(hash => {
      // one of the sidecars should be marked duplicate; the second created should be duplicate
      // since router processes files in directory order, ensure that sc2 is duplicate_of the hash
      expect(sc2.routing).to.exist;
      expect(sc2.routing.duplicate).to.equal(true);
      expect(sc2.routing.duplicate_of).to.exist;
      expect(sc2.routing.duplicate_of.hash).to.equal(hash);

      // sc1 should not be marked duplicate
      expect(sc1.routing).to.exist;
      expect(sc1.routing.duplicate).to.not.equal(true);
    });
  });

  it('skip policy prevents routing of duplicate (route marked skipped)', () => {
    const tmpSkip = path.join(__dirname, 'tmp_router_dedupe_skip');
    const navRootSkip = tmpSkip;
    const inboxSkip = path.join(tmpSkip, 'inbox');
    try { fs.rmSync(tmpSkip, { recursive: true }); } catch (e) {}
    fs.mkdirSync(inboxSkip, { recursive: true });

    // write config with dedupe policy skip
    const cfgDir = path.join(tmpSkip, 'config');
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(path.join(cfgDir, 'routing_config.json'), JSON.stringify({ dedupe: { enabled: true, policy: 'skip' } }));

    const content = 'SkipPolicyContent ' + Date.now();
    const f1 = path.join(inboxSkip, 'dup1.pdf');
    const f2 = path.join(inboxSkip, 'dup2.pdf');
    fs.writeFileSync(f1, content);
    fs.writeFileSync(f2, content);

    const cwd = path.join(__dirname, '..');
    const r = spawnSync('node', ['router.js', '--dry-run'], { cwd, env: Object.assign({}, process.env, { NAVI_ROOT: navRootSkip }), encoding: 'utf8', maxBuffer: 10*1024*1024 });
    expect(r.status).to.equal(0);

    const sc1 = JSON.parse(fs.readFileSync(f1 + '.navi.json','utf8'));
    const sc2 = JSON.parse(fs.readFileSync(f2 + '.navi.json','utf8'));

    expect(sc2.routing.duplicate).to.equal(true);
    expect(sc2.routing.rule_id).to.equal('DUPLICATE_SKIPPED_V1');
    expect(sc2.route).to.equal('mail_room.duplicate_skipped');
    // sc1 should be not duplicate
    expect(sc1.routing.duplicate).to.not.equal(true);

    try { fs.rmSync(tmpSkip, { recursive: true }); } catch (e) {}
  });

  it('tag policy adds DUPLICATE_DETECTED tag but routes normally', () => {
    const tmpTag = path.join(__dirname, 'tmp_router_dedupe_tag');
    const navRootTag = tmpTag;
    const inboxTag = path.join(tmpTag, 'inbox');
    try { fs.rmSync(tmpTag, { recursive: true }); } catch (e) {}
    fs.mkdirSync(inboxTag, { recursive: true });

    // write config with dedupe policy tag
    const cfgDir = path.join(tmpTag, 'config');
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(path.join(cfgDir, 'routing_config.json'), JSON.stringify({ dedupe: { enabled: true, policy: 'tag' } }));

    const content = 'TagPolicyContent ' + Date.now();
    const f1 = path.join(inboxTag, 'dup1.pdf');
    const f2 = path.join(inboxTag, 'dup2.pdf');
    fs.writeFileSync(f1, content);
    fs.writeFileSync(f2, content);

    const cwd = path.join(__dirname, '..');
    const r = spawnSync('node', ['router.js', '--dry-run'], { cwd, env: Object.assign({}, process.env, { NAVI_ROOT: navRootTag }), encoding: 'utf8', maxBuffer: 10*1024*1024 });
    expect(r.status).to.equal(0);

    const sc1 = JSON.parse(fs.readFileSync(f1 + '.navi.json','utf8'));
    const sc2 = JSON.parse(fs.readFileSync(f2 + '.navi.json','utf8'));

    expect(sc2.routing.duplicate).to.equal(true);
    expect(sc2.routing.reason_code).to.equal('DUPLICATE_DETECTED');
    // route should be same as first file (i.e., routed normally)
    expect(sc1.route).to.equal(sc2.route);

    try { fs.rmSync(tmpTag, { recursive: true }); } catch (e) {}
  });
});
