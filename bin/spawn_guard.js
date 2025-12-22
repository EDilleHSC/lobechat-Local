// spawn_guard.js
// Lightweight spawn guard: check existence of executable once per process and cache result.
// Usage:
//   const guard = require('./spawn_guard');
//   const ok = guard.isAvailable('uvx');
//   if (ok) { spawn('uvx', args) } else { /* fallback */ }

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const CACHE = new Map();
let diskCachePath = path.join(__dirname, '..', 'logs', 'spawn-guard-cache.json');
let diskCacheLoaded = false;

function loadDiskCache() {
  if (diskCacheLoaded) return;
  diskCacheLoaded = true;
  try {
    if (fs.existsSync(diskCachePath)) {
      const raw = fs.readFileSync(diskCachePath, 'utf8');
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        for (const k of Object.keys(obj)) { CACHE.set(k, obj[k]); }
      }
    }
  } catch (e) {
    // ignore disk cache errors
  }
}

function persistDiskCache() {
  try {
    const obj = Object.fromEntries(CACHE.entries());
    fs.mkdirSync(path.dirname(diskCachePath), { recursive: true });
    fs.writeFileSync(diskCachePath, JSON.stringify(obj), { encoding: 'utf8' });
  } catch (e) {
    // ignore
  }
}

function whichSync(cmd) {
  try {
    // On Windows: where, else: which
    const tool = process.platform === 'win32' ? 'where' : 'which';
    const out = execSync(`${tool} ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
    return !!out;
  } catch (e) {
    return false;
  }
}

function isAvailable(cmd, opts = {}) {
  const key = String(cmd);
  if (CACHE.has(key)) return CACHE.get(key).available;

  if (opts.useDiskCache) loadDiskCache();

  // perform a quick check
  const found = whichSync(cmd);
  const info = { available: !!found, checkedAt: new Date().toISOString(), cmd };
  CACHE.set(key, info);

  if (opts.useDiskCache) persistDiskCache();

  if (!found) {
    // Log a single clear warning
    const msg = `[spawn-guard] executable not found: ${cmd} (checkedAt=${info.checkedAt})`;
    try { fs.appendFileSync(path.join(__dirname, '..', 'logs', 'spawn-guard.log'), JSON.stringify({ timestamp: info.checkedAt, cmd, msg }) + '\n'); } catch (e) { console.warn(msg); }
  }

  return info.available;
}

function clearCache(cmd) {
  if (cmd) CACHE.delete(String(cmd)); else CACHE.clear();
}

module.exports = { isAvailable, clearCache, _CACHE: CACHE, _persist: persistDiskCache };
