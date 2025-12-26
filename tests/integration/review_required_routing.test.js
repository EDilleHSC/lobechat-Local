const fs = require('fs');
const path = require('path');
const http = require('http');
const { startTestServer, clearStaleFiles } = require('../helpers/startTestServer');
const waitFor = (ms) => new Promise(r => setTimeout(r, ms));

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const NAVI_ROOT = process.env.NAVI_ROOT || path.join(PROJECT_ROOT, 'NAVI');
const INBOX = path.join(NAVI_ROOT, 'inbox');
const SNAPSHOT_DIR = path.join(NAVI_ROOT, 'snapshots', 'inbox');

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

function waitForHealth(port = 8005, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise(async (resolve, reject) => {
    while (Date.now() < deadline) {
      try {
        const { statusCode } = await new Promise((res, rej) => {
          const req = http.get({ hostname: '127.0.0.1', port, path: '/health', timeout: 2000 }, (r) => res(r));
          req.on('error', rej);
        });
        if (statusCode === 200) return resolve(true);
      } catch (e) { /* ignore */ }
      await waitFor(250);
    }
    reject(new Error('Server health check timeout'));
  });
}



async function waitUntilSnapshotHasAtLeast(expectedAuto, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = fs.existsSync(SNAPSHOT_DIR) ? fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json')) : [];
    for (const f of files) {
      try {
        const snap = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, f), 'utf8'));
        if ((snap.autoRoutedCount || 0) >= expectedAuto) return { snapshotFile: f, snapshot: snap };
      } catch (e) { /* ignore */ }
    }
    await waitFor(250);
  }
  throw new Error('Timeout waiting for expected snapshot');
}

describe('review-required routing (regression)', () => {
  const port = 8020; // isolated port to avoid conflicts
  let srv = null;

  beforeAll(async () => {
    // Ensure inbox exists and is clean of our test files
    fs.mkdirSync(INBOX, { recursive: true });
    for (const f of fs.readdirSync(INBOX)) {
      if (f.startsWith('rr_test_') || f.includes('Progressive_insurance_')) {
        try { fs.unlinkSync(path.join(INBOX, f)); } catch (e) {}
      }
    }

    // remove process.lock if present to avoid skipping
    try { fs.unlinkSync(path.join(__dirname, '..', '..', 'runtime', 'current', 'process.lock')); } catch (e) {}

    // clear stale lock/pid files and start server with BATCH_LOG_THROW=1
    clearStaleFiles();
    // Increase start timeout for flaky server startups in CI
    srv = await startTestServer({ port, timeoutMs: 60000, env: { BATCH_LOG_THROW: '1' } });
    if (srv && srv.proc) {
      srv.proc.stdout.on('data', (d) => console.log('[mcp stdout]', d.toString().trim()));
      srv.proc.stderr.on('data', (d) => console.error('[mcp stderr]', d.toString().trim()));
    }
  }, 90000);

  afterAll(async () => {
    if (srv && srv.stop) await srv.stop();
  });

  test('REVIEW_REQUIRED items are moved out of NAVI/inbox, routed to office inboxes, snapshot contains review_required:true, and batch logging failures do not block routing', async () => {
    const COUNT = 5;
    const fixture = path.resolve(__dirname, '../fixtures/loric_invoice_sample.txt');
    const created = [];

    // Seed files that historically lead to review_required (bf_test_* and an insurance named file)
    for (let i = 0; i < COUNT - 1; i++) {
      const name = `rr_test_${Date.now()}_${i}.txt`;
      fs.copyFileSync(fixture, path.join(INBOX, name));
      created.push(name);
    }
    const insuranceName = `Progressive_insurance_${Date.now()}.pdf`;
    fs.copyFileSync(fixture, path.join(INBOX, insuranceName));
    created.push(insuranceName);

    // Trigger processing
    try { await triggerProcess(port); } catch (e) { /* ignore */ }

    // Wait for snapshot to be created with at least COUNT auto-routed files
    const snapRes = await waitUntilSnapshotHasAtLeast(COUNT, 30000);
    const snap = snapRes.snapshot;

    // Exact assertion requested: NAVI inbox should be empty of seeded files
    const inboxFiles = fs.readdirSync(INBOX).filter(f => !f.endsWith('.navi.json'));
    expect(inboxFiles.length).toBe(0);

    // Assert files exist in some office inbox
    const officesDir = path.join(NAVI_ROOT, 'offices');
    let totalInOffices = 0;
    let foundSeedInOffices = false;
    if (fs.existsSync(officesDir)) {
      const offices = fs.readdirSync(officesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
      for (const o of offices) {
        const inbox = path.join(officesDir, o, 'inbox');
        if (fs.existsSync(inbox)) {
          const files = fs.readdirSync(inbox).filter(f => !f.endsWith('.navi.json'));
          totalInOffices += files.length;
          for (const s of created) {
            if (files.includes(s)) foundSeedInOffices = true;
          }
        }
      }
    }
    expect(totalInOffices).toBeGreaterThanOrEqual(COUNT);
    expect(foundSeedInOffices).toBe(true);

    // Assert snapshot contains at least one autoRouted entry with review_required: true
    const hasReviewRequired = Array.isArray(snap.autoRouted) && snap.autoRouted.some(a => {
      if (!a) return false;
      if (a.review_required === true) return true;
      if (a.ai && a.ai.action === 'review_required') return true;
      if (a.ai && Array.isArray(a.ai.effective_risk_flags) && a.ai.effective_risk_flags.includes('unclear_ownership')) return true;
      return false;
    });
    expect(hasReviewRequired).toBe(true);

    // Assert that no crash occurred and batch logging failure did not block routing (snapshot exists and was processed)
    expect(snap.autoRoutedCount).toBeGreaterThanOrEqual(COUNT);

  }, 120000);
});
