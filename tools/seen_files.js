const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine NAVI root: allow override via NAVI_ROOT env var for testing
const DEFAULT_NAVI_ROOT = path.resolve(__dirname, '..', 'NAVI');

function naviRoot() {
  return process.env.NAVI_ROOT ? path.resolve(process.env.NAVI_ROOT) : DEFAULT_NAVI_ROOT;
}

function metadataDir() {
  return path.join(naviRoot(), 'metadata');
}

function seenFilePath() {
  return path.join(metadataDir(), 'seen_files.jsonl');
}

function ensureMetadataDir() {
  const dir = metadataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Append a seen file entry to the registry in JSONL format.
 * entry should be an object with at least: hash, path, filename, first_seen
 */
function appendSeenEntry(entry) {
  ensureMetadataDir();
  const line = JSON.stringify(entry) + os.EOL;
  return new Promise((resolve, reject) => {
    fs.appendFile(seenFilePath(), line, { encoding: 'utf8' }, (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

/**
 * Read registry and return all entries (parsed JSON) as an array
 */
function readAllEntries() {
  if (!fs.existsSync(seenFilePath())) return [];
  const data = fs.readFileSync(seenFilePath(), 'utf8');
  const lines = data.split(/\r?\n/).filter(Boolean);
  return lines.map(l => JSON.parse(l));
}

/**
 * Get the first entry for a given hash (or null)
 */
function getEntryByHash(hash) {
  const entries = readAllEntries();
  return entries.find(e => e.hash === hash) || null;
}

module.exports = {
  appendSeenEntry,
  readAllEntries,
  getEntryByHash,
  metadataDir,
  seenFilePath,
  ensureMetadataDir,
};
