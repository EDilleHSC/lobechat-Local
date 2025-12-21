import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const INBOX = `D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\inbox`;
const PRESENTER_URL = 'http://localhost:8005/presenter/generated/presenter.json';
const PROCESS_URL = 'http://localhost:8005/process?mode=KB';

// Small integration-style test that assumes NAVI is running locally
test('KB ingest mode prevents auto-route and exposes KB banner', async () => {
  // Skip if server is unreachable
  try {
    const r = await fetch('http://localhost:8005/health');
    if (!r.ok) test.skip('NAVI /health not responding');
  } catch (e) {
    test.skip('NAVI not running');
  }

  // Prepare two small test files in inbox
  const files = ['kb_test_1.txt', 'kb_test_2.txt'];
  try {
    // Ensure inbox exists
    if (!fs.existsSync(INBOX)) fs.mkdirSync(INBOX, { recursive: true });

    for (const f of files) {
      fs.writeFileSync(path.join(INBOX, f), `KB test content for ${f}`);
    }

    // Trigger process in KB mode
    const res = await fetch(PROCESS_URL, { method: 'POST' });
    expect(res.ok).toBeTruthy();
    const payload = await res.json();
    expect(payload.status).toBe('ok');

    // Wait a moment for presenter regeneration
    await new Promise(r => setTimeout(r, 1200));

    const presRes = await fetch(PRESENTER_URL);
    expect(presRes.ok).toBeTruthy();
    const data = await presRes.json();

    // Assertions per SOP: KB mode flag present, no auto-routes, all items require review
    expect(data.kb_mode).toBeTruthy();
    expect(data.kb_banner).toBeDefined();

    expect(data.counters.auto_routed).toBe(0);
    expect(data.counters.review_required).toBe(files.length);

  } finally {
    // Cleanup: move test files to HOLDING (safer than delete)
    const holding = path.join(path.dirname(INBOX), 'HOLDING');
    if (!fs.existsSync(holding)) fs.mkdirSync(holding, { recursive: true });
    for (const f of files) {
      const src = path.join(INBOX, f);
      if (fs.existsSync(src)) {
        try { fs.renameSync(src, path.join(holding, f)); } catch(e) { try { fs.unlinkSync(src); } catch(e){} }
      }
    }
  }
});