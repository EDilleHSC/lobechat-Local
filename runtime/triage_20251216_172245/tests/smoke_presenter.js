const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8005;
const PROCESS_URL = `http://localhost:${PORT}/process`;
const CANONICAL_INDEX = 'D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\presenter\\index.html';
const TIMEOUT_MS = 30_000;

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
          reject(new Error('Invalid JSON response from /process: ' + e.message + '\n' + body));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => reject(new Error('Timeout contacting /process')));
    req.end();
  });
}

function readIndex() {
  return fs.promises.readFile(CANONICAL_INDEX, 'utf8');
}

(async function main() {
  try {
    console.log('Triggering /process...');
    const res = await postProcess();
    if (!res || res.status !== 'ok') throw new Error('Process did not return ok: ' + JSON.stringify(res));
    console.log('Process returned ok; waiting briefly for file system settle...');
    await new Promise(r => setTimeout(r, 1000));

    // Read index file
    console.log('Reading canonical index file:', CANONICAL_INDEX);
    const index = await readIndex();

    // Assert TRUST_HEADER present
    const headerRe = /<!--\s*TRUST_HEADER[\s\S]*?rendered_at:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)[\s\S]*?snapshot_id:\s*([^\r\n]+)[\s\S]*?items_processed:\s*(\d+|UNKNOWN)[\s\S]*?-->/;
    const m = headerRe.exec(index);
    if (!m) throw new Error('TRUST_HEADER not found or malformed in index.html');

    const renderedAt = new Date(m[1]);
    const now = new Date();
    const deltaMs = Math.abs(now - renderedAt);
    console.log('Found TRUST_HEADER: rendered_at=%s (delta %dms), snapshot_id=%s, items_processed=%s', m[1], deltaMs, m[2], m[3]);

    if (deltaMs > 120_000) {
      throw new Error('rendered_at is older than 120 seconds: ' + m[1]);
    }

    console.log('Smoke test passed: TRUST_HEADER present and fresh.');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test FAILED:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
