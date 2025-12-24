const { test, expect } = require('@playwright/test');

test('presenter /health returns bound and port (or alternate presenter discovery)', async ({ request }) => {
  const port = process.env.PRESENTER_PORT || 8006;
  const res = await request.get(`http://127.0.0.1:${port}/health`);
  expect(res.ok()).toBeTruthy();
  const j = await res.json();
  if (j && j.server) {
    expect(j.server.bound).toBe(true);
    expect(j.server.port).toBeDefined();
    return;
  }

  // Fallback: ensure presenter assets are present and run_start.json exists
  const assetsRes = await request.get(`http://127.0.0.1:${port}/presenter/mail-room.html`);
  expect(assetsRes.ok()).toBeTruthy();
  const fs = require('fs');
  const path = require('path');
  const runStart = path.join(__dirname, '..', '..', 'NAVI', 'approvals', 'run_start.json');
  expect(fs.existsSync(runStart)).toBeTruthy();
  const data = JSON.parse(fs.readFileSync(runStart, 'utf8'));
  expect(data.port).toBeDefined();
});
