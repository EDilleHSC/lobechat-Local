const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const inboxPath = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\inbox";
const snapshotDir = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\snapshots\\inbox";

const files = fs.readdirSync(inboxPath).filter(file => fs.statSync(path.join(inboxPath, file)).isFile());

const snapshot = {
  source: 'manual',
  event: 'inbox_snapshot',
  timestamp: new Date().toISOString(),
  path: inboxPath,
  items: files.map(filename => {
    const filePath = path.join(inboxPath, filename);
    const stats = fs.statSync(filePath);
    return {
      name: filename,
      type: 'file',
      size: stats.size,
      modified: stats.mtime.toISOString()
    };
  }),
  status: 'unprocessed'
};

const snapshotFilename = snapshot.timestamp.replace(/[:.]/g, '-') + '.json';
const snapshotPath = path.join(snapshotDir, snapshotFilename);
fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

console.log('Snapshot created:', snapshotPath);