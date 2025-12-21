module.exports = async () => {
  const url = 'http://localhost:8005/health';
  const maxAttempts = 3;
  const delayMs = 500;
  const http = require('http');

  function ping() {
    return new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        // Accept any 2xx as healthy
        const status = res.statusCode;
        res.resume();
        if (status >= 200 && status < 300) resolve(true);
        else reject(new Error(`health check returned status ${status}`));
      });
      req.on('error', reject);
      req.setTimeout(1000, () => { req.destroy(new Error('timeout')); });
    });
  }

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await ping();
      return; // healthy
    } catch (e) {
      if (i === maxAttempts) {
        throw new Error(`NAVI health check failed at ${url}: ${e.message}.\nStart NAVI in Terminal 1: node runtime/current/mcp_server.js and wait for "=== NAVI READY ===".`);
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
};