const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { startTestServer, clearStaleFiles } = require('../helpers/startTestServer');
const waitFor = (ms) => new Promise(r => setTimeout(r, ms));
jest.setTimeout(120000);

const PROJECT_ROOT = path.resolve(__dirname, '../../');

function triggerProcess(port = 8005) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const options = { hostname: '127.0.0.1', port, path: '/process', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function findBatchLogErrorFilesRecursive(dir) {
  const results = [];
  function walk(current) {
    if (!fs.existsSync(current)) return;
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (name.startsWith('batch_log_error_') && name.endsWith('.json')) results.push(full);
    }
  }
  walk(dir);
  return results;
}

async function waitForAuditFile(dir, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = await findBatchLogErrorFilesRecursive(dir);
    if (files.length > 0) return files[0];
    await waitFor(250);
  }
  throw new Error('Timeout waiting for audit file');
}

describe('batch log audit path respects APPROVAL_DIR', () => {
  const port = 8011;
  let serverProc = null;
  let tmpNaviRoot = null;

  beforeAll(async () => {
    tmpNaviRoot = path.join(os.tmpdir(), `vboarder-naviroot-test-${Date.now()}`);
    fs.mkdirSync(tmpNaviRoot, { recursive: true });

    clearStaleFiles();
    // NAVI_ROOT drives where APPROVAL_DIR will be created (APPROVAL_DIR is NAVI_ROOT/approvals)
    serverProc = await startTestServer({ port, timeoutMs: 15000, env: { BATCH_LOG_THROW: '1', NAVI_ROOT: tmpNaviRoot } });

    if (serverProc && serverProc.proc) {
      serverProc.proc.stdout.on('data', (d) => console.log('[mcp stdout]', d.toString().trim()));
      serverProc.proc.stderr.on('data', (d) => console.error('[mcp stderr]', d.toString().trim()));
    }
  });

  afterAll(async () => {
    if (serverProc && serverProc.stop) await serverProc.stop();
    try { fs.rmSync(tmpNaviRoot, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  test('emergency audit is written under APPROVAL_DIR/audit when batch log fails', async () => {
    // Drop one file to trigger a batch
    const NAVI_ROOT = process.env.NAVI_ROOT || path.join(PROJECT_ROOT, 'NAVI');
    const INBOX = path.join(NAVI_ROOT, 'inbox');
    fs.mkdirSync(INBOX, { recursive: true });
    const fixture = path.resolve(__dirname, '../fixtures/loric_invoice_sample.txt');
    const name = `bf_test_${Date.now()}.txt`;
    fs.copyFileSync(fixture, path.join(INBOX, name));

    // Trigger processing
    try { await triggerProcess(port); } catch (e) { /* ignore */ }

    const auditPath = await waitForAuditFile(tmpNaviRoot, 60000);
    expect(fs.existsSync(auditPath)).toBe(true);
    // audit should be under NAVI_ROOT/approvals/... so ensure path contains 'approvals'
    expect(auditPath.includes(path.join('approvals')) || auditPath.includes(path.sep + 'approvals' + path.sep)).toBe(true);
    const content = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    expect(typeof content.error).toBe('string');
    expect(content.error.toLowerCase()).toMatch(/simulated/);
    expect(content.batch).toBeTruthy();
  });
});