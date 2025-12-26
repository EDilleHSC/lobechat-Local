const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME_DIR = path.join(PROJECT_ROOT, 'runtime', 'current');

// Allocate a free ephemeral TCP port safely
async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

function waitForHealth(port, timeoutMs = 60000) {
  if (!port) throw new Error('waitForHealth requires a port');
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (async function poll() {
      if (Date.now() > deadline) return reject(new Error('health check timeout'));
      try {
        // Use a 2s socket timeout but poll more aggressively for faster detection
        http.get({ hostname: '127.0.0.1', port, path: '/health', timeout: 2000 }, res => {
          // Only validate that the server responds 200 OK — do not treat /health as a deep system check
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

// spawnServer helper removed — tests must always spawn a strictly-isolated server using getFreePort()


async function startTestServer(opts = {}) {
  // Safety guard: refuse to run tests against a non-test NAVI_ROOT to avoid accidental corruption
  const envNaviRoot = (process.env.NAVI_ROOT || (opts.env && opts.env.NAVI_ROOT) || '').toLowerCase();
  if (envNaviRoot && !envNaviRoot.includes('navi_test')) {
    throw new Error(`Refusing to run tests against non-test NAVI_ROOT: ${envNaviRoot}`);
  }

  // Determine the port to use. If the caller requested a specific port, try to bind it strictly and fail if unavailable.
  let actualPort;
  if (opts && typeof opts.port === 'number' && opts.port > 0) {
    // Verify the requested port is free by attempting to listen on it briefly. If it's in use, fail immediately (no guessing).
    await new Promise((resolve, reject) => {
      const tester = net.createServer();
      tester.once('error', (err) => { tester.close(() => reject(new Error(`Requested port ${opts.port} appears in use: ${err && err.message}`))); });
      tester.listen(opts.port, '127.0.0.1', () => { actualPort = opts.port; tester.close(resolve); });
    });
  } else {
    // Allocate an ephemeral free port
    actualPort = await getFreePort();
  }
  clearStaleFiles();

  // Always start a new, isolated server for tests to avoid accidental reuse of global instances.
  // Do NOT attempt to scan logs, probe other ports, or reuse an existing server — fail fast instead.


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
  } else {
    // ensure the caller-provided NAVI_ROOT is present in child env and set
    process.env.NAVI_ROOT = naviRoot;
  }

  // Ensure tests run in NODE_ENV=test and disable the watcher to avoid startup churn
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.DISABLE_WATCHER = '1';

  // Provide a unique PID file per spawned instance so multiple test servers can run concurrently without colliding
  const pidPath = path.join(naviRoot, 'mcp_server.pid');
  opts.env = Object.assign({}, opts.env || {}, {
    NAVI_ROOT: naviRoot,
    NODE_ENV: process.env.NODE_ENV,
    DISABLE_WATCHER: '1',
    WATCHER_DISABLED: '1',
    MCP_TEST_MODE: '1',
    MCP_PID_FILE: pidPath
  });

  const nodePath = process.execPath;
  const child = spawn(nodePath, [path.join(RUNTIME_DIR, 'mcp_server.js')], {
    cwd: RUNTIME_DIR,
    env: Object.assign({}, process.env, opts.env || {}, { PORT: String(actualPort) }),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Capture a small tail of child's stdout/stderr for better diagnostics in case of early exit
  let childStdoutBuf = '';
  let childStderrBuf = '';
  child.stdout.on('data', d => {
    const s = d.toString();
    childStdoutBuf = (childStdoutBuf + s).slice(-2000);
    process.stdout.write('[mcp stdout] ' + s);
  });
  child.stderr.on('data', d => {
    const s = d.toString();
    childStderrBuf = (childStderrBuf + s).slice(-2000);
    process.stderr.write('[mcp stderr] ' + s);
  });

  // Fail FAST if the child exits at any point — do not wait for /health when the child dies
  const exitPromise = new Promise((_, reject) => {
    child.once('exit', (code, signal) => {
      const logPath = path.join(RUNTIME_DIR, 'server_out.log');
      let tail = '';
      try { if (fs.existsSync(logPath)) tail = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-200).join('\n'); } catch (e) { }
      reject(new Error(`startTestServer: mcp_server exited early (code=${code}, signal=${signal})\n${tail}\n=== child stdout ===\n${childStdoutBuf}\n=== child stderr ===\n${childStderrBuf}`));
    });
  });

  // If the child already exited synchronously (rare), fail immediately with diagnostics
  if (typeof child.exitCode !== 'undefined' && child.exitCode !== null) {
    const logPath = path.join(RUNTIME_DIR, 'server_out.log');
    let tail = '';
    try { if (fs.existsSync(logPath)) tail = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-200).join('\n'); } catch (e) { }
    throw new Error('mcp_server child exited prematurely with code ' + child.exitCode + '\n' + tail.slice(-1000) + '\n=== child stdout ===\n' + (childStdoutBuf || '') + '\n=== child stderr ===\n' + (childStderrBuf || ''));
  }



  // wait for health endpoint (with diagnostics on failure) — race against early child exit
  try {
    const healthPromise = waitForHealth(actualPort, opts.timeoutMs || 60000);

    // Race health check against the exitPromise (which rejects immediately if child dies)
    await Promise.race([healthPromise, exitPromise]);
    // Ensure health actually resolved (this will re-throw if waitForHealth rejected)
    await healthPromise;
  } catch (err) {
    // Diagnostic output and fail — do NOT try to reuse or detect other servers
    console.error('startTestServer: health check failed:', err && err.message ? err.message : err);
    let serverOutTail = '';
    try {
      const logPath = path.join(RUNTIME_DIR, 'server_out.log');
      if (fs.existsSync(logPath)) {
        const tail = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-200).join('\n');
        serverOutTail = tail;
        console.error('--- server_out.log (last 200 lines) ---\n', tail);
      } else {
        console.error('server_out.log not found at', logPath);
      }
    } catch (e) { console.error('failed to read server_out.log', e); }
    try { console.error('Runtime dir listing:', fs.readdirSync(RUNTIME_DIR).slice(-50)); } catch (e) { }
    try { if (child && typeof child.exitCode !== 'undefined') console.error('child.exitCode:', child.exitCode); } catch (e) { }

    // Heuristic: if server_out.log shows the server is 'ready' or '[BIND] server.listening: true', try to extract a port and reuse it
    // Do not attempt to reuse any running server — we intentionally fail fast. The diagnostics printed above
    // (server_out.log, child stdout/stderr) are for the test author to analyze.


    // No reuse or scanning — fail fast and let the caller inspect the diagnostics above.
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