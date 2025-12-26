const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

function mkTmpRoot() {
  return path.join(os.tmpdir(), `navi_router_mailroom_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
}

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const ROUTER_CLI = path.join(PROJECT_ROOT, 'runtime', 'current', 'router.js');
const MAILROOM = path.join(PROJECT_ROOT, 'runtime', 'mailroom_runner.py');

describe('Router -> Mailroom package presence check', () => {
  let tmp;

  beforeEach(async () => {
    tmp = mkTmpRoot();
    await fs.mkdir(path.join(tmp, 'NAVI', 'inbox'), { recursive: true });
    await fs.mkdir(path.join(tmp, 'NAVI', 'offices', 'CTO', 'inbox'), { recursive: true });
    await fs.mkdir(path.join(tmp, 'NAVI', 'packages'), { recursive: true });

    // routing config: filename override Navi_ -> CTO
    const cfg = {
      filename_overrides: { 'Navi_': 'CTO' },
      function_to_office: { Tech: 'CTO' }
    };
    await fs.mkdir(path.join(tmp, 'NAVI', 'config'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'NAVI', 'config', 'routing_config.json'), JSON.stringify(cfg), 'utf8');

    // drop file in inbox that matches override
    await fs.writeFile(path.join(tmp, 'NAVI', 'inbox', 'Navi_Final_Smoke.txt'), 'smoke', 'utf8');
  });

  afterEach(async () => {
    try { await fs.rm(tmp, { recursive: true, force: true }); } catch (e) {}
  });

  test('file ends up in CTO inbox (direct or inside package)', async () => {
    const env = Object.assign({}, process.env, { NAVI_ROOT: path.join(tmp, 'NAVI') });

    // Run router to create package / sidecar
    const r = spawnSync('node', [ROUTER_CLI, '--apply', '--force', '--limit', '1'], { env, encoding: 'utf8' });
    expect(r.status).toBe(0);

    // Find Python
    const python = process.env.MAILROOM_PYTHON || 'python';
    const run = spawnSync(python, [MAILROOM], { env, encoding: 'utf8', timeout: 15000 });
    if (run.error) {
      console.warn('Python not available, skipping mailroom run in this environment');
      return;
    }
    expect(run.status).toBe(0);

    // Check CTO inbox for either direct file or package containing it
    const ctoInbox = path.join(tmp, 'NAVI', 'offices', 'CTO', 'inbox');
    const files = await fs.readdir(ctoInbox).catch(() => []);

    // direct presence
    if (files.includes('Navi_Final_Smoke.txt')) return;

    // package presence
    const pkgDirs = files.filter(f => f.startsWith('CTO_BATCH-'));
    let found = false;
    for (const pd of pkgDirs) {
      const pkgPath = path.join(ctoInbox, pd);
      const pkgFiles = await fs.readdir(pkgPath).catch(() => []);
      if (pkgFiles.includes('Navi_Final_Smoke.txt')) { found = true; break; }
    }
    expect(found).toBe(true);
  }, 30000);
});
