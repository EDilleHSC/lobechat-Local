import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const INBOX = `D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\inbox`;
const PRESENTER_URL = 'http://localhost:8005/presenter/generated/presenter.json';
const PROCESS_URL = 'http://localhost:8005/process';

// Integration test: submit a human decision via /clear_exceptions and assert presenter.json is updated
test('submit decisions via clear_exceptions updates presenter.json', async () => {
  // Skip if server is unreachable
  try {
    const r = await fetch('http://localhost:8005/health');
    if (!r.ok) test.skip('NAVI /health not responding');
  } catch (e) {
    test.skip('NAVI not running');
  }

  const fileName = 'approve_test.txt';
  const filePath = path.join(INBOX, fileName);

  try {
    // Ensure inbox exists and write file
    if (!fs.existsSync(INBOX)) fs.mkdirSync(INBOX, { recursive: true });
    fs.writeFileSync(filePath, 'Approval test content');

    // Trigger processing (normal mode)
    const res = await fetch(PROCESS_URL, { method: 'POST' });
    expect(res.ok).toBeTruthy();
    const payload = await res.json();
    expect(payload.status).toBe('ok');

    // Wait for presenter to include our file
    async function waitForPresenterIncludes(url, filename, retries = 20, delay = 500) {
      for (let i = 0; i < retries; i++) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            const data = await r.json();
            if ((data.items || []).some(it => it.filename === filename)) return data;
          }
        } catch (e) { }
        await new Promise(r => setTimeout(r, delay));
      }
      throw new Error('Presenter did not include file in time');
    }

    const presenter = await waitForPresenterIncludes(PRESENTER_URL, fileName);

    // Build decisions payload matching server expectation
    const ts = new Date().toISOString();
    const decisions = [{ filename: fileName, final_route: 'Finance', timestamp: ts, human_reason: 'Automated test' }];

    const submitRes = await fetch('http://localhost:8005/clear_exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions, reviewer: 'playwright-test', timestamp: ts })
    });

    expect(submitRes.ok).toBeTruthy();

    // Wait for presenter.json to be updated with human_routed_files
    async function waitForHumanRouted(url, filename, retries = 10, delay = 500) {
      for (let i = 0; i < retries; i++) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data.human_routed_files) && data.human_routed_files.some(h => h.filename === filename)) return data;
          }
        } catch (e) { }
        await new Promise(r => setTimeout(r, delay));
      }
      throw new Error('Presenter did not reflect human routing in time');
    }

    const updated = await waitForHumanRouted(PRESENTER_URL, fileName);
    const matched = updated.human_routed_files.find(h => h.filename === fileName);
    expect(matched).toBeDefined();
    expect(matched.final_route).toBe('Finance');

  } finally {
    // Cleanup file
    const holding = path.join(path.dirname(INBOX), 'HOLDING');
    if (!fs.existsSync(holding)) fs.mkdirSync(holding, { recursive: true });
    if (fs.existsSync(filePath)) {
      try { fs.renameSync(filePath, path.join(holding, fileName)); } catch(e) { try { fs.unlinkSync(filePath); } catch(e){} }
    }
  }
});