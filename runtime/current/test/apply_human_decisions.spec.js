const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const child = require('child_process');

function runScript(args, env) {
  const script = path.resolve(__dirname, '..', '..', '..', 'scripts', 'apply_human_decisions.js');
  const res = child.spawnSync('node', [script, ...args], { env: Object.assign({}, process.env, env || {}), encoding: 'utf8' });
  return res;
}

describe('apply_human_decisions script', function() {
  this.timeout(10000);
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vboarder-test-'));
    // create NAVI layout
    fs.mkdirSync(path.join(tmp, 'approvals'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'inbox'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'offices'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'storage'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'config'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'config', 'routing_config.json'), JSON.stringify({}));
  });
  afterEach(() => {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  });

  it('applies a ROUTE decision (creates storage and office copies, removes source)', () => {
    const srcFile = path.join(tmp, 'inbox', 'testfile.pdf');
    fs.writeFileSync(srcFile, 'dummy');
    // minimal routing config
    const cfg = {
      route_paths: { 'DESK.Finance': 'storage/finance/file.pdf' },
      function_to_office: { 'Finance': 'FinanceDesk' }
    };
    fs.mkdirSync(path.join(tmp, 'config'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'config', 'routing_config.json'), JSON.stringify(cfg));

    const review = {
      batchId: 'b1', reviewer: 'tester', decisions: [ { filename: 'testfile.pdf', final_route: 'DESK.Finance' } ]
    };
    const reviewPath = path.join(tmp, 'approvals', 'review_decisions_test.json');
    fs.writeFileSync(reviewPath, JSON.stringify(review));

    // dry-run should succeed
    const dry = runScript(['--file', reviewPath], { REVIEW_NAVI_ROOT: tmp });
    assert.strictEqual(dry.status, 0);
    assert.ok(dry.stdout.includes('Dry-run'));

    // apply should require --force
    const bad = runScript(['--file', reviewPath, '--apply'], { REVIEW_NAVI_ROOT: tmp });
    assert.notStrictEqual(bad.status, 0);

    // now apply with force
    const ok = runScript(['--file', reviewPath, '--apply', '--force'], { REVIEW_NAVI_ROOT: tmp });
    assert.strictEqual(ok.status, 0, 'apply exited non-zero: ' + ok.stderr);

    const storageTarget = path.join(tmp, 'storage', 'finance', 'file.pdf');
    assert.ok(fs.existsSync(storageTarget), 'storage target missing');
    const officeInbox = path.join(tmp, 'offices', 'FinanceDesk', 'inbox');
    const officeFile = path.join(officeInbox, 'testfile.pdf');
    assert.ok(fs.existsSync(officeFile), 'office copy missing');
    assert.ok(!fs.existsSync(srcFile), 'source should be removed');
  });

  it('applies a TRASH/discard decision (moves to archive/trash)', () => {
    const srcFile = path.join(tmp, 'inbox', 'trashit.pdf');
    fs.writeFileSync(srcFile, 'trash');
    const review = { batchId: 'b2', reviewer: 'tester', decisions: [ { filename: 'trashit.pdf', final_route: 'TRASH' } ] };
    const reviewPath = path.join(tmp, 'approvals', 'review_decisions_trash.json');
    fs.writeFileSync(reviewPath, JSON.stringify(review));

    const ok = runScript(['--file', reviewPath, '--apply', '--force'], { REVIEW_NAVI_ROOT: tmp });
    if (ok.status !== 0) {
      console.error('STDOUT:\n', ok.stdout);
      console.error('STDERR:\n', ok.stderr);
    }
    assert.strictEqual(ok.status, 0);
    const trashFile = path.join(tmp, 'archive', 'trash', 'trashit.pdf');
    assert.ok(fs.existsSync(trashFile), 'trash target missing');
    assert.ok(!fs.existsSync(srcFile), 'source should be removed');
  });
});
