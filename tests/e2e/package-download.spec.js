const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let serverProc = null;
const PORT = process.env.PRESENTER_PORT || 8105;
const serverUrl = process.env.PRESENTER_URL || `http://127.0.0.1:${PORT}`;

async function waitForHealth(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url + '/health');
      if (res.ok) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Server health check failed');
}

test.beforeAll(async () => {
  // If server already running (from unit tests) reuse it; otherwise spawn a subprocess
  try {
    const res = await fetch(serverUrl + '/health');
    if (res.ok) return; // server already up
  } catch (e) {
    // not up yet, spawn
  }

  serverProc = spawn(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'serve_presenter.js')], { stdio: 'inherit', env: Object.assign({}, process.env, { PORT: String(PORT) }) });
  await waitForHealth(serverUrl);
});

test.afterAll(() => {
  if (serverProc) serverProc.kill();
});

test('Playwright: download package zip from presenter', async ({ context }) => {
  const packagesDir = path.join(__dirname, '..', '..', 'NAVI', 'packages');
  const pkgName = 'e2e_test_pkg';
  const pkgDir = path.join(packagesDir, pkgName);
  // prepare package
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'a.txt'), 'hello');

  // Use a fresh page to navigate directly to the download URL and wait for the download event
  const downloadUrl = `${serverUrl}/api/packages/${encodeURIComponent(pkgName)}/download`;

  // Use Playwright APIRequest to fetch the zip and assert body non-empty
  const apiRes = await context.request.get(downloadUrl);
  if (!apiRes.ok()) {
    const txt = await apiRes.text();
    throw new Error(`Download failed: status=${apiRes.status()} body=${txt.slice(0,200)}`);
  }
  const buf = await apiRes.body();
  expect(buf.length).toBeGreaterThan(0);

  // assert cache file exists and mtime stable on second request
  const zipPath = path.join(packagesDir, `${pkgName}.zip`);
  expect(fs.existsSync(zipPath)).toBeTruthy();
  const m1 = fs.statSync(zipPath).mtimeMs;

  // second request should use cached zip (mtime unchanged)
  const apiRes2 = await context.request.get(downloadUrl);
  if (!apiRes2.ok()) throw new Error('Second download failed');
  const buf2 = await apiRes2.body();
  expect(buf2.length).toBeGreaterThan(0);
  const m2 = fs.statSync(zipPath).mtimeMs;
  expect(m2).toBe(m1);

  // cleanup
  fs.rmSync(pkgDir, { recursive: true, force: true });
});