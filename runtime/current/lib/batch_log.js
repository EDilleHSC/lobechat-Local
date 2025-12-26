const fs = require('fs');
const path = require('path');

function logBatch(batchStats, options = {}) {
  if (!batchStats) throw new Error('batchStats is required');

  // Test hook: allow simulated failure via env var for testing robustness
  if (process.env.BATCH_LOG_THROW === '1') {
    throw new Error('simulated batch log failure (env:BATCH_LOG_THROW=1)');
  }

  // Determine NAVI root: prefer options override, then env var, then relative NAVI
  const naviRoot = options.naviRoot || process.env.NAVI_ROOT || path.resolve(__dirname, '..', '..', 'NAVI');

  const date = new Date();
  const dateDir = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const dir = path.join(naviRoot, 'logs', 'batches', dateDir);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `batch-${date.toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, JSON.stringify(batchStats, null, 2));

  return filePath;
}

// Async write with timeout and a race to avoid blocking when filesystem hangs or errors
async function writeBatchLogSafe(batchStats, options = {}) {
  if (!batchStats) throw new Error('batchStats is required');

  const timeoutMs = (options && typeof options.timeout === 'number') ? options.timeout : 5000;

  // Simulated failure hook for tests
  if (process.env.BATCH_LOG_THROW === '1') {
    return Promise.reject(new Error('simulated batch log failure (env:BATCH_LOG_THROW=1)'));
  }

  const naviRoot = options.naviRoot || process.env.NAVI_ROOT || path.resolve(__dirname, '..', '..', 'NAVI');
  const date = new Date();
  const dateDir = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const dir = path.join(naviRoot, 'logs', 'batches', dateDir);

  // Ensure directory exists
  await fs.promises.mkdir(dir, { recursive: true });

  const filename = `batch-${date.toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(dir, filename);

  const writeOp = fs.promises.writeFile(filePath, JSON.stringify(batchStats, null, 2)).then(() => filePath);

  const timeoutOp = new Promise((_, reject) => setTimeout(() => reject(new Error('Batch log write timeout')), timeoutMs));

  return Promise.race([writeOp, timeoutOp]);
}

module.exports = { logBatch, writeBatchLogSafe };