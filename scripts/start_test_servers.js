#!/usr/bin/env node
const { spawn } = require('child_process');
const fetch = globalThis.fetch;
if (!fetch) { console.error('[start_test_servers] global fetch not available; ensure Node has fetch or set up node-fetch fallback'); process.exit(1); }

const PRESENTER_CMD = process.env.PRESENTER_CMD || 'node';
const PRESENTER_ARGS = process.env.PRESENTER_ARGS ? process.env.PRESENTER_ARGS.split(' ') : ['scripts/serve_presenter.js'];
const NAVI_CMD = process.env.NAVI_CMD || 'node';
const NAVI_ARGS = process.env.NAVI_ARGS ? process.env.NAVI_ARGS.split(' ') : ['runtime/current/mcp_server.js'];
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 8005;
const HEALTH_URL = `http://${HOST}:${PORT}/health`;
const TIMEOUT = parseInt(process.env.SERVERS_TIMEOUT || '120000', 10);

let presenter, navi;

function spawnProcess(cmd, args, name, opts = {}) {
  const spawnOpts = { stdio: ['ignore', 'inherit', 'inherit'], shell: false, env: { ...process.env, ...(opts.env || {}) } };
  const p = spawn(cmd, args, spawnOpts);
  p.on('exit', (code, sig) => console.log(`[start_test_servers] ${name} exited: code=${code} sig=${sig}`));
  p.on('error', (err) => console.error(`[start_test_servers] ${name} error:`, err));
  return p;
}

async function waitForHealth(url, timeout) {
  const deadline = Date.now() + timeout;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const res = await fetch(url);
      console.log(`[start_test_servers] health check attempt ${attempt}: status=${res.status}`);
      if (res.ok) {
        const j = await res.json();
        console.log('[start_test_servers] health payload:', j && j.server ? j.server : j);
        // Consider presenter-style health (j.server.bound) OR NAVI-style health (j.ok with presenter_last)
        if ((j && j.server && j.server.bound) || (j && j.ok && (j.presenter_last || j.timestamp || j.pid))) {
          console.log('[start_test_servers] health check indicates ready');
          return true;
        }
      }
    } catch (e) {
      console.log(`[start_test_servers] health check attempt ${attempt} failed: ${e && e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function start() {
  console.log('[start_test_servers] Starting presenter...');
  // Ensure presenter writes discovery file, fails on port conflict, and use dedicated presenter port for tests
  presenter = spawnProcess(PRESENTER_CMD, PRESENTER_ARGS, 'presenter', { env: { ...process.env, WRITE_PORT_FILE: '1', FAIL_ON_PORT_CONFLICT: '1', PORT: '8006' } });

  console.log('[start_test_servers] Starting NAVI (mcp_server)...');
  navi = spawnProcess(NAVI_CMD, NAVI_ARGS, 'navi', { env: { ...process.env } });

  console.log(`[start_test_servers] Waiting up to ${TIMEOUT}ms for presenter at ${HEALTH_URL}`);
  const ready = await waitForHealth(HEALTH_URL, TIMEOUT);
  if (!ready) {
    console.error('[start_test_servers] Presenter failed to become ready in time');
    process.exit(1);
  }

  console.log('[start_test_servers] Presenter is ready — leaving processes running for Playwright to use');

  // Keep alive until terminated
  const keepAlive = setInterval(() => {}, 1000);

  function shutdown() {
    clearInterval(keepAlive);
    console.log('[start_test_servers] Shutting down child processes...');
    if (presenter && !presenter.killed) presenter.kill('SIGTERM');
    if (navi && !navi.killed) navi.kill('SIGTERM');
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(err => { console.error('[start_test_servers] Fatal error starting servers:', err); process.exit(1); });
