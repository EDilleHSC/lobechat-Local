const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, Object.assign({ stdio: 'inherit' }, opts));
    p.on('close', code => {
      if (code === 0) resolve(); else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
    p.on('error', err => reject(err));
  });
}

(async () => {
  try {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const naviRoot = path.join(projectRoot, 'NAVI');
    const inbox = path.join(naviRoot, 'inbox');
    const agentInbox = path.join(naviRoot, 'agents', 'agent1', 'inbox');
    const snapDir = path.join(naviRoot, 'snapshots', 'inbox');

    await fs.mkdir(inbox, { recursive: true });
    await fs.mkdir(agentInbox, { recursive: true });
    await fs.mkdir(snapDir, { recursive: true });

    const filename = `e2e_node_${Date.now()}.txt`;
    const inboxPath = path.join(inbox, filename);

    await fs.writeFile(inboxPath, 'E2E node test', 'utf8');
    console.log('Wrote test file:', inboxPath);

    const stat = await fs.stat(inboxPath);
    const snapName = new Date().toISOString().replace(/:/g, '-') + '.json';
    const snapPath = path.join(snapDir, snapName);
    const snapshot = { items: [{ name: filename, size: stat.size, timestamp: new Date().toISOString() }] };
    await fs.writeFile(snapPath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log('Created snapshot:', snapPath);

    // Run the simple router which routes files according to latest snapshot
    const routerPath = path.join(projectRoot, 'runtime', 'router.js');
    console.log('Running router:', routerPath);
    await runCmd('node', [routerPath]);

    // Poll for the file in agent inbox
    const dst = path.join(agentInbox, filename);
    let ok = false;
    for (let i = 0; i < 40; i++) {
      try {
        await fs.access(dst);
        ok = true;
        break;
      } catch (e) {
        await sleep(250);
      }
    }

    if (!ok) throw new Error('Routed file not found in agent inbox: ' + dst);
    console.log('Routed file present:', dst);

    const metaPath = dst + '.meta.json';
    const metaRaw = await fs.readFile(metaPath, 'utf8');
    const meta = JSON.parse(metaRaw);
    if (meta.filename !== filename) throw new Error('Meta filename mismatch');
    console.log('Meta file verified:', metaPath);

    // Cleanup
    await fs.rm(dst, { force: true });
    await fs.rm(metaPath, { force: true });
    await fs.rm(inboxPath, { force: true }).catch(() => {});
    await fs.rm(snapPath, { force: true });
    console.log('E2E test succeeded and cleaned up');
    process.exit(0);
  } catch (err) {
    console.error('E2E test failed:', err);
    process.exit(2);
  }
})();