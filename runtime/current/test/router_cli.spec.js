const { expect } = require('chai');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUNTIME_DIR = path.resolve(__dirname, '..');
const NODE = process.execPath;

function runRouter(args, envOverrides = {}) {
  const result = spawnSync(
    NODE,
    [path.join(RUNTIME_DIR, 'router.js'), ...args],
    {
      cwd: RUNTIME_DIR,
      env: { ...process.env, ...envOverrides },
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    }
  );
  return result;
}

describe('router CLI safety flags', () => {
  const NAVI_ROOT = path.join(RUNTIME_DIR, '..', 'NAVI_TEST_CLI');

  before(() => {
    // Minimal env for router to run without touching production NAVI
    process.env.NAVI_ROOT = NAVI_ROOT;
    try {
      fs.mkdirSync(path.join(NAVI_ROOT, 'inbox'), { recursive: true });
    } catch (e) {}
  });

  it('errors when --apply and --dry-run are combined without --force', () => {
    const { status, stdout, stderr } = runRouter(['--apply', '--dry-run', '--limit', '5']);

    // Expect non‑zero exit code
    expect(status).to.not.equal(0);

    // Expect an explanatory message mentioning apply, dry-run, and force
    const combined = (stdout || '') + (stderr || '');
    expect(combined).to.match(/apply/i);
    expect(combined).to.match(/dry[- ]run/i);
    expect(combined).to.match(/force/i);
  });

  it('allows --apply and --dry-run when --force is present', () => {
    const { status, stdout, stderr } = runRouter(['--apply', '--dry-run', '--limit', '5', '--force']);

    // Should exit cleanly (0) even if it finds no files
    expect(status).to.equal(0);

    const combined = (stdout || '') + (stderr || '');
    // Should look like a dry‑run, not an error
    expect(combined.toLowerCase()).to.not.match(/error/);
  });
});
