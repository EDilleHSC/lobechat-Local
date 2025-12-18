const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let PORT = Number(process.env.PORT) || null;
const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'mcp_server.js');
const PID_FILE = path.join(__dirname, '..', 'mcp_server.pid');

const TIMEOUT_MS = 10000;

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const s = net.createConnection({ port }, () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
  });
}

function waitForFile(filePath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (fs.existsSync(filePath)) return resolve(true);
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout waiting for file'));
      setTimeout(poll, 200);
    })();
  });
}

function waitForFileGone(filePath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (!fs.existsSync(filePath)) return resolve(true);
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout waiting for file removal'));
      setTimeout(poll, 200);
    })();
  });
}

(async function main() {
  try {
    console.log('PID-file smoke test starting...');

    // Pick an ephemeral free port if one wasn't provided via PORT env
    if (!PORT) {
      PORT = await new Promise((resolve, reject) => {
        const s = net.createServer();
        s.listen(0, () => {
          const p = s.address().port;
          s.close(() => resolve(p));
        });
        s.on('error', (e) => reject(e));
      });
      console.log('Selected ephemeral test port:', PORT);
    }

    const inUse = await checkPortInUse(PORT);
    if (inUse) {
      console.log(`[SKIP] Port ${PORT} appears to be in use; skipping smoke test.`);
      process.exit(0);
    }

    // Ensure no stale pidfile
    try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch (e) {}

    console.log('Spawning server process...');
    const child = spawn(process.execPath, [SERVER], { detached: false, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { PORT: String(PORT) }) });

    child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
    child.stderr.on('data', (d) => process.stderr.write(`[server:err] ${d}`));

    // Wait for PID file
    await waitForFile(PID_FILE, TIMEOUT_MS);
    console.log('PID file appeared:', PID_FILE);

    const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) throw new Error('PID file did not contain a valid PID');

    // Confirm process exists (may be child or same)
    try {
      process.kill(pid, 0);
      console.log('PID in file corresponds to a running process:', pid);
    } catch (e) {
      throw new Error('PID in file does not correspond to a running process: ' + pid);
    }

    // Now kill the child process
    console.log('Sending SIGTERM to child process...');
    child.kill();

    // wait for child exit
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('child did not exit in time')), TIMEOUT_MS);
      child.on('exit', (code, sig) => { clearTimeout(t); resolve(); });
    });

    // Wait for pidfile removal
    await waitForFileGone(PID_FILE, TIMEOUT_MS);
    console.log('PID file removed after shutdown. Test passed.');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test FAILED:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
