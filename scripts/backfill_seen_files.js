#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { computeFileHash } = require('../tools/file_hash');
const { appendSeenEntry, getEntryByHash, ensureMetadataDir } = require('../tools/seen_files');

const argv = require('minimist')(process.argv.slice(2));
const NAVI_ROOT = argv['navi-root'] || process.env.NAVI_ROOT || path.resolve(__dirname, '..', 'NAVI');
const dryRun = !!argv['dry-run'] || !!argv['dryrun'] || false;
const limit = argv.limit ? parseInt(argv.limit, 10) : Infinity;

function listFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const items = fs.readdirSync(dir);
  for (const it of items) {
    const p = path.join(dir, it);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listFilesRecursive(p));
    else if (st.isFile() && !p.toLowerCase().endsWith('.navi.json')) out.push(p);
  }
  return out;
}

(async function main(){
  console.log('NAVI root:', NAVI_ROOT);
  const inbox = path.join(NAVI_ROOT, 'inbox');
  const sorted = path.join(NAVI_ROOT, 'sorted');
  const toScan = [];

  toScan.push(...listFilesRecursive(inbox));
  toScan.push(...listFilesRecursive(sorted));

  console.log('Found', toScan.length, 'files to inspect');

  ensureMetadataDir();

  let added = 0;
  let processed = 0;
  for (const f of toScan) {
    if (processed >= limit) break;
    try {
      const hash = await computeFileHash(f);
      const seen = getEntryByHash(hash);
      if (!seen) {
        if (dryRun) {
          console.log('[DRY] Would append:', hash, path.relative(NAVI_ROOT, f));
        } else {
          await appendSeenEntry({ hash, path: path.relative(NAVI_ROOT, f), filename: path.basename(f), first_seen: new Date().toISOString() });
          console.log('Appended:', hash, path.relative(NAVI_ROOT, f));
        }
        added += 1;
      }
    } catch (err) {
      console.error('Error processing', f, err && err.message ? err.message : String(err));
    }
    processed += 1;
  }

  console.log('Processed', processed, 'files. Added', added, 'new registry entries.');
})();
