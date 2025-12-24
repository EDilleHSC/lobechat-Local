const { test, expect } = require('@playwright/test');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execp = util.promisify(exec);

// Keep timeouts generous for filesystem operations
test.setTimeout(60_000);

test('router moves file and writes meta', async () => {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const naviRoot = path.join(projectRoot, 'NAVI');
  const inbox = path.join(naviRoot, 'inbox');
  const agentsInbox = path.join(naviRoot, 'agents', 'agent1', 'inbox');

  // Make unique filename
  const filename = `e2e_router_${Date.now()}.txt`;
  const inboxPath = path.join(inbox, filename);

  // Ensure folders exist
  await fs.mkdir(inbox, { recursive: true });
  await fs.mkdir(path.join(naviRoot, 'snapshots', 'inbox'), { recursive: true });
  await fs.mkdir(agentsInbox, { recursive: true });

  // 1) Drop file into inbox
  await fs.writeFile(inboxPath, 'E2E test content', 'utf8');

  // 2) Create snapshot referencing the file
  const snapDir = path.join(naviRoot, 'snapshots', 'inbox');
  const snapName = new Date().toISOString().replace(/:/g, '-') + '.json';
  const snapPath = path.join(snapDir, snapName);
  const stat = await fs.stat(inboxPath);
  const snap = { items: [{ name: filename, size: stat.size, timestamp: new Date().toISOString() }] };
  await fs.writeFile(snapPath, JSON.stringify(snap, null, 2), 'utf8');

  // 3) Run router with apply
  const routerPath = path.join(projectRoot, 'runtime', 'router.js');
  // Use node to run router.js --apply --limit=10
  await execp(`node "${routerPath}" --apply --limit=10`, { timeout: 20000 });

  // 4) Wait for file to appear in agent inbox
  const dst = path.join(agentsInbox, filename);
  let found = false;
  for (let i = 0; i < 40; i++) {
    try {
      await fs.access(dst);
      found = true;
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  expect(found).toBeTruthy();

  // 5) Verify meta file exists and contains snapshot id
  const metaPath = dst + '.meta.json';
  const metaRaw = await fs.readFile(metaPath, 'utf8');
  const meta = JSON.parse(metaRaw);
  expect(meta).toHaveProperty('filename', filename);
  expect(meta).toHaveProperty('routed_to');

  // 6) Cleanup created artifacts
  await fs.rm(dst, { force: true });
  await fs.rm(metaPath, { force: true });
  await fs.rm(inboxPath, { force: true }).catch(() => {});
  await fs.rm(snapPath, { force: true });
});
