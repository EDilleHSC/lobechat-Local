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

    // Wait for presenter regeneration (polling to avoid flaky timing)
    async function waitForPresenter(url, retries = 10, delay = 500) {
      for (let i = 0; i < retries; i++) {
        try {
          const r = await fetch(url);
          if (r.ok) return await r.json();
        } catch (e) {
          // ignore and retry
        }
        await new Promise(r => setTimeout(r, delay));
      }
      throw new Error('Presenter did not appear in time');
    }

    const data = await waitForPresenter(PRESENTER_URL);

    // Assertions per SOP: KB mode flag present, no auto-routes, all items require review
    expect(data.kb_mode).toBeTruthy();
    expect(data.kb_banner).toBeDefined();

    expect(data.counters.auto_routed).toBe(0);
    expect(data.counters.review_required).toBe(files.length);

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

// Additional test: ensure KB+BETA0 early-return does not leak CURRENT_PROCESS_MODE across runs
test('KB mode with BETA0 early-return does not leak mode (admin endpoints required)', async () => {
  // Skip if admin endpoints are not enabled
  try {
    const setRes = await fetch('http://localhost:8005/__mcp_set_beta0?value=1&token=TEST_SHUTDOWN', { method: 'POST' });
    if (setRes.status === 403) test.skip('Admin endpoints not enabled');
    if (!setRes.ok) test.skip('Cannot set BETA0 on server');
  } catch (e) { test.skip('Admin endpoints not available'); }

  // Prepare a small test file
  const f = 'kb_beta0_test.txt';
  try {
    if (!fs.existsSync(INBOX)) fs.mkdirSync(INBOX, { recursive: true });
    fs.writeFileSync(path.join(INBOX, f), `KB beta0 test content`);

    // Trigger process in KB mode (BETA0 active, should return early but reset mode)
    const res = await fetch('http://localhost:8005/process?mode=KB', { method: 'POST' });
    expect(res.ok).toBeTruthy();
    const payload = await res.json();
    expect(payload.status).toBe('ok');

    // Wait briefly, then query debug endpoint to ensure mode reset
    await new Promise(r => setTimeout(r, 500));
    const debugRes = await fetch('http://localhost:8005/__mcp_debug?token=TEST_SHUTDOWN');
    expect(debugRes.ok).toBeTruthy();
    const dbg = await debugRes.json();
    expect(dbg.CURRENT_PROCESS_MODE).toBe('DEFAULT');

    // Turn BETA0 off
    const setRes2 = await fetch('http://localhost:8005/__mcp_set_beta0?value=0&token=TEST_SHUTDOWN', { method: 'POST' });
    expect(setRes2.ok).toBeTruthy();

    // Trigger a normal process (should execute normally and not be in KB mode)
    const res2 = await fetch('http://localhost:8005/process', { method: 'POST' });
    expect(res2.ok).toBeTruthy();
    const payload2 = await res2.json();
    expect(payload2.status).toBe('ok');

    // Wait for presenter and assert kb_mode is not present
    const data2 = await (async function waitForPresenter(url, retries = 10, delay = 500) {
      for (let i = 0; i < retries; i++) {
        try {
          const r = await fetch(url);
          if (r.ok) return await r.json();
        } catch (e) { }
        await new Promise(r => setTimeout(r, delay));
      }
      throw new Error('Presenter did not appear in time');
    })(PRESENTER_URL);

    expect(data2.kb_mode).toBeFalsy();

  } finally {
    const src = path.join(INBOX, f);
    const holding = path.join(path.dirname(INBOX), 'HOLDING');
    if (!fs.existsSync(holding)) fs.mkdirSync(holding, { recursive: true });
    if (fs.existsSync(src)) try { fs.renameSync(src, path.join(holding, f)); } catch(e) { try { fs.unlinkSync(src); } catch(e){} }
  }
});