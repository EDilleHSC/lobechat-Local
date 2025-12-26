const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME_DIR = path.join(PROJECT_ROOT, 'runtime', 'current');

function waitForHealth(port = 8005, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (async function poll() {
      if (Date.now() > deadline) return reject(new Error('health check timeout'));
      try {
        http.get({ hostname: '127.0.0.1', port, path: '/health', timeout: 2000 }, res => {
          if (res.statusCode === 200) return resolve();
          setTimeout(poll, 200);
        }).on('error', () => setTimeout(poll, 200));
      } catch (e) { setTimeout(poll, 200); }
    })();
  });
}

function clearStaleFiles() {
  try { fs.unlinkSync(path.join(RUNTIME_DIR, 'process.lock')); } catch (e) { }
  try { fs.unlinkSync(path.join(RUNTIME_DIR, 'mcp_server.pid')); } catch (e) { }
}

function spawnServer(port = 8005, env = {}) {
  const envVars = Object.assign({}, process.env, env, { PORT: String(port) });
  const node = process.execPath;
  const child = spawn(node, [path.join(RUNTIME_DIR, 'mcp_server.js')], { env: envVars, stdio: ['ignore', 'pipe', 'pipe'] });
  return child;
}

async function startTestServer(opts = {}) {
  const port = opts.port || 0; // 0 => let OS choose; but we prefer explicit port for tests
  const actualPort = opts.port || 8005;

  // If a server is already running and healthy on the desired port, prefer to reuse it
  try {
    await waitForHealth(actualPort, 2000);
    console.log('startTestServer: existing server healthy on port', actualPort);
    return { port: actualPort, proc: null, async stop() { /* no-op for shared server */ } };
  } catch (e) {
    // not up yet — proceed to try starting a local instance
  }

  // If there's a PID file for an existing server, try to discover its listening port from logs and reuse it
  try {
    const pidFile = path.join(RUNTIME_DIR, 'mcp_server.pid');
    if (fs.existsSync(pidFile)) {
      const logPath = path.join(RUNTIME_DIR, 'server_out.log');
      if (fs.existsSync(logPath)) {
        const tail = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-200).join('\n');
        const m = tail.match(/Server will listen on port (\d+)/i);
        if (m && m[1]) {
          const detectedPort = Number(m[1]);
          try {
            await waitForHealth(detectedPort, 2000);
            console.log('startTestServer: reusing existing server found from logs on port', detectedPort);
            return { port: detectedPort, proc: null, async stop() { /* no-op for shared server */ } };
          } catch (e) {
            // existing server not healthy; fall through to spawn attempt
          }
        }
      }
    }
  } catch (e) {
    // ignore failures in this discovery step
  }

  clearStaleFiles();

  // Ensure an isolated NAVI_ROOT for this test server instance to avoid cross-test interference
  // If caller provided NAVI_ROOT in opts.env, use it; otherwise create a temporary NAVI_ROOT and
  // set it in the current test process env so the test assertions refer to the same directory.
  const os = require('os');
  const crypto = require('crypto');
  let naviRoot = (opts.env && opts.env.NAVI_ROOT) ? opts.env.NAVI_ROOT : null;
  if (!naviRoot) {
    const tmpBase = path.join(os.tmpdir(), 'navi_test');
    if (!fs.existsSync(tmpBase)) fs.mkdirSync(tmpBase, { recursive: true });
    naviRoot = path.join(tmpBase, `NAVI_${actualPort}_${crypto.randomBytes(4).toString('hex')}`);
    // create canonical NAVI layout expected by server/tests
    fs.mkdirSync(path.join(naviRoot, 'inbox'), { recursive: true });
    fs.mkdirSync(path.join(naviRoot, 'snapshots', 'inbox'), { recursive: true });
    fs.mkdirSync(path.join(naviRoot, 'offices'), { recursive: true });
    fs.mkdirSync(path.join(naviRoot, 'approvals'), { recursive: true });
    fs.mkdirSync(path.join(naviRoot, 'presenter', 'generated'), { recursive: true });

    // Expose this NAVI_ROOT to the test process so tests use the same directory
    process.env.NAVI_ROOT = naviRoot;
    // Also ensure opts.env will be passed to child
    opts.env = Object.assign({}, opts.env || {}, { NAVI_ROOT: naviRoot });
  } else {
    // ensure the caller-provided NAVI_ROOT is present in child env
    opts.env = Object.assign({}, opts.env || {}, { NAVI_ROOT: naviRoot });
  }

  const child = spawnServer(actualPort, opts.env || {});

  // expose logs for debugging
  child.stdout.on('data', d => process.stdout.write('[mcp stdout] ' + d.toString()));
  child.stderr.on('data', d => process.stderr.write('[mcp stderr] ' + d.toString()));

  // wait for health endpoint (with diagnostics on failure)
  try {
    await waitForHealth(actualPort, opts.timeoutMs || 20000);
  } catch (err) {
    // If health check fails, make a best-effort scan for any healthy server on common ports for the remainder of the timeout
    const timeout = opts.timeoutMs || 20000;
    const deadline = Date.now() + timeout;
    const candidates = Array.from(new Set([actualPort, 8007, 8005, 8020]));
    let foundPort = null;
    while (Date.now() < deadline && !foundPort) {
      for (const p of candidates) {
        try {
          await waitForHealth(p, 2000);
          foundPort = p;
          break;
        } catch (e) {
          // ignore and try next
        }
      }
      if (!foundPort) await new Promise(r => setTimeout(r, 250));
    }

    if (foundPort) {
      console.log('startTestServer: detected existing server on port', foundPort);
      return { port: foundPort, proc: null, async stop() { /* no-op for shared server */ } };
    }

    // Diagnostic output and fail
    console.error('startTestServer: health check failed:', err && err.message ? err.message : err);
    try {
      const logPath = path.join(RUNTIME_DIR, 'server_out.log');
      if (fs.existsSync(logPath)) {
        const tail = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-100).join('\n');
        console.error('--- server_out.log (last 100 lines) ---\n', tail);
      } else {
        console.error('server_out.log not found at', logPath);
      }
    } catch (e) { console.error('failed to read server_out.log', e); }
    try { console.error('Runtime dir listing:', fs.readdirSync(RUNTIME_DIR).slice(-50)); } catch (e) { }
    throw err;
  }

  return {
    port: actualPort,
    proc: child,
    async stop() {
      try { child.kill(); } catch (e) { }
      // give it a moment and cleanup lock file
      await new Promise(r => setTimeout(r, 200));
      clearStaleFiles();
    }
  };
}

module.exports = { startTestServer, clearStaleFiles, waitForHealth };