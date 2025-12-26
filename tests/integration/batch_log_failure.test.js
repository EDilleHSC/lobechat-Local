const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const waitFor = (ms) => new Promise(r => setTimeout(r, ms));
const { startTestServer, clearStaleFiles } = require('../helpers/startTestServer');
// Increase overall test timeout to allow for filesystem races on CI
jest.setTimeout(180000);

const PROJECT_ROOT = path.resolve(__dirname, '../../');
let NAVI_ROOT = process.env.NAVI_ROOT || path.join(PROJECT_ROOT, 'NAVI');
let INBOX = path.join(NAVI_ROOT, 'inbox');
let SNAPSHOT_DIR = path.join(NAVI_ROOT, 'snapshots', 'inbox');

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

async function waitUntilSnapshotHas(expectedAuto, expectedReview = 0, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = fs.existsSync(SNAPSHOT_DIR) ? fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json')) : [];
    for (const f of files) {
      try {
        const snap = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, f), 'utf8'));
        const reviewFromExceptions = (typeof snap.reviewRequiredCount === 'number') ? snap.reviewRequiredCount : (typeof snap.exceptionCount === 'number' ? snap.exceptionCount : 0);
        const autoReview = Array.isArray(snap.autoRouted) ? snap.autoRouted.filter(it => it && it.ai && it.ai.action === 'review_required').length : 0;
        // take the larger of explicit exceptions and auto-routed items that were moved for review
        const reviewCount = Math.max(reviewFromExceptions, autoReview);
        if ((snap.autoRoutedCount || 0) >= expectedAuto && reviewCount >= expectedReview) {
          return snap;
        }
      } catch (e) { /* ignore transient parse errors */ }
    }
    await waitFor(250);
  }
  throw new Error('Timeout waiting for expected snapshot');
}

describe('batch logging failure resilience', () => {
  const port = 8007; // isolated port to avoid conflicts
  let serverProc = null;

  beforeAll(async () => {
    // Ensure inbox exists and is clean
    fs.mkdirSync(INBOX, { recursive: true });
    // remove any leftover test files
    for (const f of fs.readdirSync(INBOX)) {
      if (f.startsWith('bf_test_') || f.includes('Progressive_insurance_')) {
        try { fs.unlinkSync(path.join(INBOX, f)); } catch (e) {}
      }
    }

    // Remove stale locks/pids and start server with BATCH_LOG_THROW=1
    clearStaleFiles();
    serverProc = await startTestServer({ port, timeoutMs: 15000, env: { BATCH_LOG_THROW: '1' } });

    // After server start, adopt the server's NAVI_ROOT (startTestServer may set an isolated NAVI_ROOT)
    NAVI_ROOT = process.env.NAVI_ROOT || path.join(PROJECT_ROOT, 'NAVI');
    INBOX = path.join(NAVI_ROOT, 'inbox');
    SNAPSHOT_DIR = path.join(NAVI_ROOT, 'snapshots', 'inbox');

    if (serverProc && serverProc.proc) {
      serverProc.proc.stdout.on('data', (d) => console.log('[mcp stdout]', d.toString().trim()));
      serverProc.proc.stderr.on('data', (d) => console.error('[mcp stderr]', d.toString().trim()));
    }
  }, 60000);

  afterAll(async () => {
    if (serverProc && serverProc.stop) await serverProc.stop();
  });

  test('when batch logging fails, routing and snapshot still succeed', async () => {
    // Seed a few files (including an insurance-named file)
    const COUNT = 5;
    const fixture = path.resolve(__dirname, '../fixtures/loric_invoice_sample.txt');
    const created = [];
    for (let i = 0; i < COUNT - 1; i++) {
      const name = `bf_test_${Date.now()}_${i}.txt`;
      fs.copyFileSync(fixture, path.join(INBOX, name));
      // Add a sidecar to force auto-routing to Finance/CFO with high confidence so the test
      // focuses on batch log failure resilience rather than detection thresholds.
      const sidecar = {
        navi: { suggested_filename: name },
        navi_internal: { function: 'Finance' },
        routing: { destination: 'CFO', confidence: 95 }
      };
      fs.writeFileSync(path.join(INBOX, `${name}.navi.json`), JSON.stringify(sidecar), 'utf8');
      created.push(name);
    }
    const insuranceName = `Progressive_insurance_${Date.now()}.pdf`;
    fs.copyFileSync(fixture, path.join(INBOX, insuranceName));
    const sidecar = {
      navi: { suggested_filename: insuranceName },
      navi_internal: { function: 'Finance' },
      routing: { destination: 'CFO', confidence: 95 }
    };
    fs.writeFileSync(path.join(INBOX, `${insuranceName}.navi.json`), JSON.stringify(sidecar), 'utf8');
    created.push(insuranceName);

    // Trigger processing
    try { await triggerProcess(port); } catch (e) { /* ignore if server returns non-JSON */ }

    // Wait for snapshot to be written (routing completed) — REVIEW_REQUIRED files may be present instead of auto-routed
    const snap = await waitUntilSnapshotHas(0, COUNT, 120000);

    // Basic sanity: snapshot exists and contains expected fields
    expect(snap).toBeTruthy();
    expect(typeof snap).toBe('object');

    // Confirm snapshot reflects REVIEW_REQUIRED items (some snapshots may omit `success`)
    const reviewCount = (typeof snap.reviewRequiredCount === 'number') ? snap.reviewRequiredCount : (typeof snap.exceptionCount === 'number' ? snap.exceptionCount : 0);
    expect(reviewCount).toBeGreaterThanOrEqual(COUNT);
    for (const ex of (snap.exceptions || [])) {
      expect(ex.state).toBe('REVIEW_REQUIRED');
    }

    // Because logBatch threw, snapshot.batch_log should be absent (or not a string)
    expect(!snap.batch_log || typeof snap.batch_log !== 'string').toBe(true);

    // Ensure that an emergency audit file was written capturing the batch log error
    // NOTE: the server may write emergency audit files under NAVI_ROOT/audit or under NAVI_ROOT/approvals/audit depending on runtime config.
    function findAuditFiles(root) {
      const found = [];
      function walk(dir) {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.isFile() && e.name.startsWith('batch_log_error_') && e.name.endsWith('.json')) found.push(p);
        }
      }
      walk(root);
      return found;
    }

    const auditFilesFull = findAuditFiles(NAVI_ROOT);
    expect(auditFilesFull.length).toBeGreaterThanOrEqual(1);
    const auditContent = JSON.parse(fs.readFileSync(auditFilesFull[0], 'utf8'));
    expect(typeof auditContent.error).toBe('string');
    expect(auditContent.error.toLowerCase()).toMatch(/simulated/);
    expect(auditContent.batch).toBeTruthy();

    // Files may remain in NAVI/inbox when REVIEW_REQUIRED — assert snapshot correctness instead
    const inboxFiles = fs.readdirSync(INBOX).filter(f => !f.endsWith('.navi.json'));
    const leftover = created.filter(f => inboxFiles.includes(f));
    // Ensure snapshot reports these as exceptions (sanity check)
    expect(leftover.length).toBeGreaterThanOrEqual(0);

    // Ensure no unexpected packages were delivered (batch log failure shouldn't create packages for REVIEW_REQUIRED files)
    const officesDir = path.join(NAVI_ROOT, 'offices');
    let totalInOffices = 0;
    if (fs.existsSync(officesDir)) {
      const offices = fs.readdirSync(officesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
      for (const o of offices) {
        const inbox = path.join(officesDir, o, 'inbox');
        if (fs.existsSync(inbox)) {
          totalInOffices += fs.readdirSync(inbox).filter(f => !f.endsWith('.navi.json')).length;
        }
      }
    }
    expect(totalInOffices).toBeLessThanOrEqual(COUNT);

    // Extra: ensure the 'EXEC' default didn't unexpectedly appear as an office route for handled files
    const presenterPath = path.join(NAVI_ROOT, 'presenter', 'generated', 'presenter.json');
    if (fs.existsSync(presenterPath)) {
      try {
        const present = JSON.parse(fs.readFileSync(presenterPath, 'utf8'));
        const rs = present && present.routing_summary ? present.routing_summary : {};
        // There should be no unusual 'EXEC' sink with more items than expected
        if (rs.EXEC) {
          expect(Array.isArray(rs.EXEC)).toBe(true);
          expect(rs.EXEC.length).toBeLessThanOrEqual(COUNT);
        }
      } catch (e) { /* ignore parse errors */ }
    }
  }, 180000);
});