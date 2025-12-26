const fs = require('fs');
const path = require('path');
const { startTestServer, clearStaleFiles } = require('../helpers/startTestServer');
const waitFor = (ms) => new Promise(r => setTimeout(r, ms));

jest.setTimeout(30000);

describe('insurance normalization and override', () => {
  const filename = 'Final_Insurance_Test.pdf';
  const content = "Progressive Insurance Policy #12345 Premium Due";
  let PROJECT_ROOT = path.resolve(__dirname, '../../');
  let NAVI_ROOT = process.env.NAVI_ROOT || path.join(PROJECT_ROOT, 'NAVI');
  let INBOX = path.join(NAVI_ROOT, 'inbox');
  let PACKAGES = path.join(NAVI_ROOT, 'packages');
  const port = 8031;
  let srv = null;

  beforeAll(async () => {
    clearStaleFiles();
    srv = await startTestServer({ port, timeoutMs: 60000 });
    NAVI_ROOT = process.env.NAVI_ROOT || path.join(PROJECT_ROOT, 'NAVI');
    INBOX = path.join(NAVI_ROOT, 'inbox');
    PACKAGES = path.join(NAVI_ROOT, 'packages');
    fs.mkdirSync(INBOX, { recursive: true });
    fs.writeFileSync(path.join(INBOX, filename), content, { encoding: 'utf8' });
    // trigger process on the test server port
    await (async function triggerProcess(port = 8031) {
      return new Promise((resolve, reject) => {
        const http = require('http');
        const data = JSON.stringify({});
        const options = { hostname: '127.0.0.1', port, path: '/process', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
        const req = http.request(options, (res) => {
          let body = '';
          res.on('data', (c) => body += c);
          res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { resolve(body); } });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });
    })(port);
  });

  afterAll(async () => {
    if (srv && srv.stop) await srv.stop();
  });

  test('sidecar should be auto routed to CFO with insurance_override', async () => {
    // wait/poll for mailroom / packages / snapshot to be created (up to 8s)
    const waitForCondition = async (checkFn, timeout = 8000, interval = 250) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (checkFn()) return true;
        await waitFor(interval);
      }
      return false;
    };

    await waitForCondition(() => {
      try {
        // Check for snapshot or package or office or processed presence
        const snapsDir = path.join(NAVI_ROOT, 'snapshots', 'inbox');
        if (fs.existsSync(snapsDir) && fs.readdirSync(snapsDir).some(f => f.endsWith('.json'))) return true;
        const pkgs = fs.existsSync(PACKAGES) && fs.readdirSync(PACKAGES).length > 0;
        if (pkgs) return true;
        const officesDir = path.join(NAVI_ROOT, 'offices');
        if (fs.existsSync(officesDir) && fs.readdirSync(officesDir).some(o => fs.existsSync(path.join(officesDir, o, 'inbox')) && fs.readdirSync(path.join(officesDir, o, 'inbox')).some(ff => ff.includes(filename)))) return true;
        const processedDir = path.join(NAVI_ROOT, 'processed');
        if (fs.existsSync(processedDir) && fs.readdirSync(processedDir).some(d => fs.readdirSync(path.join(processedDir, d)).some(ff => ff.includes(filename)))) return true;
      } catch (e) { }
      return false;
    }, 8000, 250);
    // Search packages first, then office inboxes if not found
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return [];
      let out = [];
      for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        if (fs.statSync(fp).isDirectory()) out = out.concat(walk(fp));
        else if (f.includes(filename)) out.push(fp);
      }
      return out;
    };

    let files = walk(PACKAGES);

    // If no package, search offices and processed folders
    if (files.length === 0) {
      const officesDir = path.join(NAVI_ROOT, 'offices');
      if (fs.existsSync(officesDir)) {
        for (const office of fs.readdirSync(officesDir)) {
          const inboxDir = path.join(officesDir, office, 'inbox');
          const found = walk(inboxDir);
          if (found.length) { files = files.concat(found); }
        }
      }

      // Also search processed snapshot folders where applyRoute may have moved files when package assembly isn't available
      const processedDir = path.join(NAVI_ROOT, 'processed');
      if (fs.existsSync(processedDir)) {
        for (const day of fs.readdirSync(processedDir)) {
          const dayDir = path.join(processedDir, day);
          const found = walk(dayDir);
          if (found.length) files = files.concat(found);
        }
      }
    }

    if (files.length > 0) {
      // If the found entry is a sidecar, read it. If it's an office-downloaded file, there should be a .navi.json next to it
      let scPath = files[0];
      if (!scPath.endsWith('.navi.json')) {
        const maybe = scPath + '.navi.json';
        if (fs.existsSync(maybe)) scPath = maybe;
      }
      const sc = JSON.parse(fs.readFileSync(scPath, 'utf8'));
      expect(sc.routing.destination).toBe('CFO');
      expect(sc.ai_classification.department).toBe('CFO');
      expect(sc.ai_classification.normalization).toBe('insurance_override');
      expect(sc.routing.reasons).toContain('insurance_override');
    } else {
      // Fallback: verify the latest snapshot contains evidence of auto-routing and the insurance override
      const snapsDir = path.join(NAVI_ROOT, 'snapshots', 'inbox');
      const snaps = fs.existsSync(snapsDir) ? fs.readdirSync(snapsDir).filter(f => f.endsWith('.json')).sort() : [];
      expect(snaps.length).toBeGreaterThan(0);
      const latest = snaps[snaps.length - 1];
      const snap = JSON.parse(fs.readFileSync(path.join(snapsDir, latest), 'utf8'));
      const raw = JSON.stringify(snap);
      expect(raw.includes('Final_Insurance_Test.pdf')).toBeTruthy();
      expect(raw.includes('insurance_override')).toBeTruthy();
    }
  });
});
