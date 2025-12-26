const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const NAVI_ROOT = path.join(__dirname, '..', '..', 'NAVI');
const INBOX = path.join(NAVI_ROOT, 'inbox');

describe('Finance routing regression', () => {
  const testFile = path.join(INBOX, 'regression_test_invoice.txt');

  beforeAll(() => {
    if (!fs.existsSync(INBOX)) fs.mkdirSync(INBOX, { recursive: true });
    const content = 'Invoice: #99999\nPlease process payment and reconcile. ASAP payment due.';
    fs.writeFileSync(testFile, content, 'utf8');
  });

  afterAll(() => {
    try { fs.unlinkSync(testFile); } catch(e) {}
    try { fs.unlinkSync(testFile + '.navi.json'); } catch(e) {}
  });

  test('routes finance-like content to CFO with autoRoute and sufficient confidence', () => {
    const router = path.join(__dirname, '..', '..', 'runtime', 'current', 'router.js');
    const res = spawnSync('node', [router, '--dry-run', '--path', testFile], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    expect(res.status).toBe(0);
    // output may be on stdout or stderr depending on implementation
    const out = (res.stdout || res.stderr || '').trim();
    expect(out).toBeTruthy();
    const parsed = JSON.parse(out);
    expect(parsed.routed_files).toBeInstanceOf(Array);
    expect(parsed.routed_files.length).toBeGreaterThan(0);
    const entry = parsed.routed_files.find(e => e.src && e.src.endsWith('regression_test_invoice.txt'));
    expect(entry).toBeTruthy();
    expect(entry.route).toBe('CFO');
    expect(entry.autoRoute).toBeTruthy();
    // if confidence present in sidecar, ensure >= 70
    const sidecarPath = testFile + '.navi.json';
    if (fs.existsSync(sidecarPath)) {
      const sc = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
      expect(sc.function).toBe('Finance');
      expect(typeof sc.confidence).toBe('number');
      expect(sc.confidence).toBeGreaterThanOrEqual(70);
    }
  });
});