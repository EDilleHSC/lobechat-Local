const fs = require('fs');
const path = require('path');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForCondition(checkFn, { timeout = 10000, interval = 250, debugName = '' } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await Promise.resolve(checkFn())) return true;
    } catch (e) {
      // swallow and retry
    }
    await wait(interval);
  }
  // final attempt for useful debug info
  try {
    if (debugName) console.error(`[waitForCondition] timeout waiting for ${debugName}`);
  } catch (e) {}
  return false;
}

module.exports = { wait, waitForCondition };
