const fs = require('fs').promises;
const path = require('path');

const LOG_DIR_DEFAULT = path.join(__dirname, '..', 'NAVI', 'approvals');
const LOG_FILE = 'audit.log';

async function readAuditRaw() {
  const p = path.join(LOG_DIR_DEFAULT, LOG_FILE);
  try {
    const raw = await fs.readFile(p, 'utf8');
    return raw;
  } catch (e) {
    // If missing, return empty string
    return '';
  }
}

function parseLine(line) {
  // Example line:
  // [2025-12-20 01:10:17] Automation Tester marked Client_Notes_Intro.docx → Track — E2E manual test
  const m = line.match(/\[(.+?)\]\s+(.+?)\s+marked\s+(.+?)\s+→\s+(\w+)(?:\s+—\s+(.*))?/);
  if (!m) return null;
  const ts = m[1];
  const by = m[2];
  const file = m[3];
  const decision = m[4];
  const notes = m[5] || '';
  // Attempt to parse timestamp into ISO 8601
  let timestamp;
  try {
    timestamp = new Date(ts.replace(' ', 'T')).toISOString();
  } catch (e) {
    timestamp = new Date().toISOString();
  }
  return { timestamp, by, file, decision, notes };
}

async function parseAudit() {
  const raw = await readAuditRaw();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const parsed = lines.map(parseLine).filter(Boolean);
  // Return newest first
  return parsed.reverse();
}

module.exports = { parseAudit };