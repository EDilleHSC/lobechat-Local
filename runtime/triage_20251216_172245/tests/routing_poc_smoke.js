const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..', '..', '..');
const INBOX = path.join(ROOT, 'NAVI', 'inbox');
const AGENT_INBOX = path.join(ROOT, 'NAVI', 'agents', 'agent1', 'inbox');
const PRESENT = path.join(ROOT, 'NAVI', 'presenter', 'index.html');
const GENERATED_PRESENT = path.join(ROOT, 'NAVI', 'presenter', 'generated', 'index.html');
const PORT = Number(process.env.PORT) || 8005;
const PROCESS_URL = `http://localhost:${PORT}/process`;

function ensureNaviDirs() {
  const navi = path.join(ROOT, 'NAVI');
  try {
    fs.mkdirSync(path.join(navi, 'inbox'), { recursive: true });
    fs.mkdirSync(path.join(navi, 'agents', 'agent1', 'inbox'), { recursive: true });
    fs.mkdirSync(path.join(navi, 'presenter'), { recursive: true });
  } catch (e) {
    console.warn('Failed to create NAVI dirs:', e.message || e);
  }
}

function writeInboxFile(name, content) {
  if (!fs.existsSync(INBOX)) fs.mkdirSync(INBOX, { recursive: true });
  fs.writeFileSync(path.join(INBOX, name), content, 'utf8');
}

function postProcess() {
  return new Promise((resolve, reject) => {
    const req = http.request(PROCESS_URL, { method: 'POST' }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid /process response: ' + body));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const fname = 'route_smoke.txt';
  const content = 'route smoke ' + Date.now();

  // ensure NAVI dirs and cleanup
  ensureNaviDirs();
  if (!fs.existsSync(AGENT_INBOX)) fs.mkdirSync(AGENT_INBOX, { recursive: true });
  try { fs.unlinkSync(path.join(AGENT_INBOX, fname)); } catch (e) {}
  try { fs.unlinkSync(path.join(AGENT_INBOX, fname + '.meta.json')); } catch (e) {}

  // write file to inbox
  writeInboxFile(fname, content);

  // run process
  console.log('Triggering /process...');
  const res = await postProcess();
  console.log('Process response:', res);

  // compute paths we'll check
  const routedPath = path.join(AGENT_INBOX, fname);
  const metaPath = path.join(AGENT_INBOX, fname + '.meta.json');

  // wait for router to write meta file (poll with timeout)
  const waitFor = async (p, timeoutMs = 5000, intervalMs = 200) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (fs.existsSync(p)) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  };

  let metaExists = await waitFor(metaPath, 5000, 200);
  if (!metaExists) {
    console.warn('Meta file not found after wait; attempting router fallback');
    try {
      const cp = require('child_process');
      const routerPath = path.join(ROOT, 'runtime', 'router.js');
      cp.execSync(`node "${routerPath}"`, { stdio: 'inherit' });
    } catch (e) {
      console.warn('Router fallback failed:', e.message || e);
    }

    // wait a bit more
    metaExists = await waitFor(metaPath, 2000, 200);
    if (!metaExists) {
      console.error('FAIL: Meta file not found after router fallback:', metaPath);
      process.exit(3);
    }
  }

  // check agent inbox
  if (!fs.existsSync(routedPath)) {
    console.error('FAIL: Routed file not found:', routedPath);
    process.exit(2);
  }
  if (!fs.existsSync(metaPath)) {
    console.error('FAIL: Meta file not found:', metaPath);
    process.exit(3);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  console.log('Meta:', meta);

  // checksum
  const crypto = require('crypto');
  const data = fs.readFileSync(routedPath);
  const sha = crypto.createHash('sha256').update(data).digest('hex');
  if (sha !== meta.checksum_sha256) {
    console.error('FAIL: checksum mismatch', sha, meta.checksum_sha256);
    process.exit(4);
  }

  // check presenter for trust header reference (prefer canonical, fallback to generated preview)
  let present = '';
  try { present = fs.readFileSync(PRESENT, 'utf8'); } catch (e) { present = ''; }
  if (present.indexOf(meta.snapshot_id) === -1) {
    console.log('snapshot id not found in canonical presenter; checking generated preview', GENERATED_PRESENT);
    try { present = fs.readFileSync(GENERATED_PRESENT, 'utf8'); } catch (e) { present = ''; }
  }
  if (present.indexOf(meta.snapshot_id) === -1) {
    console.error('FAIL: presenter does not reference snapshot id from meta');
    process.exit(5);
  }

  console.log('PASS: routing POC smoke test succeeded');
  process.exit(0);
})();
