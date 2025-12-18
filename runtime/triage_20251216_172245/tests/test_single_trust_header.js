const http = require('http');
const PORT = Number(process.env.PORT) || 8005;
const URL = `http://localhost:${PORT}/presenter/index.html`;
const TIMEOUT_MS = 15000;
const RETRY_INTERVAL = 1000;

function fetchOnce() {
  return new Promise((resolve, reject) => {
    const req = http.request(URL, { method: 'GET' }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Request timed out')));
    req.end();
  });
}

async function fetchWithRetry(timeoutMs = TIMEOUT_MS) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetchOnce();
      if (res.status === 200) return res.body;
      lastErr = new Error('HTTP ' + res.status);
    } catch (e) {
      lastErr = e;
    }
    await new Promise(r => setTimeout(r, RETRY_INTERVAL));
  }
  throw lastErr || new Error('Timeout waiting for server');
}

(async function main() {
  try {
    const body = await fetchWithRetry();
    const matches = (body.match(/<!--\s*TRUST_HEADER/g) || []).length;
    console.log('TRUST_HEADER count:', matches);
    if (matches !== 1) {
      console.error('FAIL: Expected exactly one TRUST_HEADER in served HTML');
      console.error('--- Served HTML head (first 2KB) ---');
      console.error(body.slice(0, 2048));
      process.exit(2);
    }
    console.log('PASS: Exactly one TRUST_HEADER present');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err && err.message ? err.message : err);
    process.exit(3);
  }
})();
