const fs = require('fs');
const path = require('path');
const http = require('http');
const { startTestServer, clearStaleFiles } = require('../helpers/startTestServer');
jest.setTimeout(120000);
const waitFor = (ms) => new Promise(r => setTimeout(r, ms));

let PROJECT_ROOT = path.resolve(__dirname, '../../');
let NAVI_ROOT = process.env.NAVI_ROOT || path.join(PROJECT_ROOT, 'NAVI');
let INBOX = path.join(NAVI_ROOT, 'inbox');
let SNAPSHOT_DIR = path.join(NAVI_ROOT, 'snapshots', 'inbox');

function triggerProcess(port = 8031) {
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

async function waitUntilSnapshotHasAutoAtLeast(expectedAuto, timeoutMs = 60000) {
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

describe('AI classification prototype', () => {
  const port = 8031;
  let srv = null;

  beforeAll(async () => {
    clearStaleFiles();
    const testAI = JSON.stringify({ doc_type: 'insurance', department: 'CFO', confidence: 92, reasoning: 'Progressive Insurance policy document' });
    srv = await startTestServer({ port, timeoutMs: 60000, env: { TEST_AI_CLASSIFICATION: testAI } });
    NAVI_ROOT = process.env.NAVI_ROOT || path.join(PROJECT_ROOT, 'NAVI');
    INBOX = path.join(NAVI_ROOT, 'inbox');
    SNAPSHOT_DIR = path.join(NAVI_ROOT, 'snapshots', 'inbox');
    fs.mkdirSync(INBOX, { recursive: true });
  }, 120000);

  afterAll(async () => {
    if (srv && srv.stop) await srv.stop();
  });

  test('AI classification is written to sidecar for routed file', async () => {
    const fixture = path.resolve(__dirname, '../fixtures/loric_invoice_sample.txt');
    const name = `AI_classify_sidecar_test_${Date.now()}.pdf`;
    const dest = path.join(INBOX, name);
    fs.copyFileSync(fixture, dest);

    await triggerProcess(port);

    const snapRes = await waitUntilSnapshotHasAutoAtLeast(1, 60000);
    const snap = snapRes.snapshot;

    const auto = Array.isArray(snap.autoRouted) ? snap.autoRouted.find(it => it && it.filename === name) : null;
    expect(auto).toBeTruthy();

    // Sidecar must contain ai_classification
    expect(auto.sidecar).toBeTruthy();
    expect(auto.sidecar.ai_classification).toBeTruthy();
    const ai = auto.sidecar.ai_classification;
    expect(ai.doc_type).toBe('insurance');
    expect(ai.department).toBe('CFO');
    expect(Number(ai.confidence || 0)).toBeGreaterThanOrEqual(90);
    expect(ai.reasoning).toMatch(/Progressive Insurance/);

    // Our router should have recorded the AI suggestion in reasons
    expect((auto.sidecar.routing.reasons || auto.ai.reasons || []).some(r => String(r).startsWith('ai_suggestion:'))).toBe(true);
  }, 90000);
});