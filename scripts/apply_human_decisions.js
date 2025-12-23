#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NAVI = path.join(ROOT, 'NAVI');
const APPROVALS = path.join(NAVI, 'approvals');
const CONFIG_PATH = path.join(NAVI, 'config', 'routing_config.json');

function findLatestReviewFile() {
  if (!fs.existsSync(APPROVALS)) return null;
  const files = fs.readdirSync(APPROVALS).filter(f => f.startsWith('review_decisions_') && f.endsWith('.json'))
    .map(f => ({ f, t: fs.statSync(path.join(APPROVALS, f)).mtimeMs }))
    .sort((a,b) => b.t - a.t);
  return files.length ? path.join(APPROVALS, files[0].f) : null;
}

function loadConfig() {
  const cfgPath = ENV_NAVI ? path.join(ENV_NAVI, 'config', 'routing_config.json') : CONFIG_PATH;
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    throw new Error('Failed to read routing_config.json: ' + e.message + ' (path: ' + cfgPath + ')');
  }
}

function getTargetsForRoute(route, cfg) {
  const rp = (cfg.route_paths) || {};
  const fp = (cfg.function_to_office) || {};
  const storageRel = rp[route] || null;
  const naviRoot = ENV_NAVI || NAVI;
  const storage = storageRel ? path.normalize(path.join(naviRoot, storageRel)) : null;
  const func = (route || '').split('.')[1] || null;
  const officeName = func && fp[func] ? fp[func] : null;
  const officeInbox = officeName ? path.normalize(path.join(naviRoot, 'offices', officeName, 'inbox')) : null;
  return { storage, storageRel, officeName, officeInbox };
}

function usage() {
  console.log('Usage: node scripts/apply_human_decisions.js [--file <path>] [--apply] [--force]');
  process.exit(1);
}

// Allow overriding NAVI root via env for tests: REVIEW_NAVI_ROOT
const ENV_NAVI = process.env.REVIEW_NAVI_ROOT || process.env.NAVI_ROOT;

async function main() {
  const argv = process.argv.slice(2);
  let fileArg = null;
  let doApply = false;
  let force = false;
  for (let i=0;i<argv.length;i++) {
    const a = argv[i];
    if (a === '--file' && argv[i+1]) { fileArg = argv[i+1]; i++; }
    else if (a === '--apply') doApply = true;
    else if (a === '--force') force = true;
    else if (a === '--help') usage();
    else { usage(); }
  }

  const filePath = fileArg ? path.resolve(fileArg) : findLatestReviewFile();
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('No review_decisions file found. Use --file <path> to specify one.');
    process.exit(2);
  }

  if (doApply && !force) {
    console.error('Safety: --apply requires --force to run. To perform actions: --apply --force');
    process.exit(3);
  }

  const cfg = loadConfig();
  // Determine NAVI root (allow override via env)
  const NAVI_ROOT = ENV_NAVI || path.join(ROOT, 'NAVI');

  // helper to find source file under NAVI root
  function findSourceFile(filename) {
    // common candidates
    const inbox = path.join(NAVI_ROOT, 'inbox', filename);
    if (fs.existsSync(inbox)) return inbox;
    // search whole NAVI tree (cheap for tests)
    function searchDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isFile() && e.name === filename) return p;
        if (e.isDirectory()) {
          const res = searchDir(p);
          if (res) return res;
        }
      }
      return null;
    }
    try { return searchDir(NAVI_ROOT); } catch (e) { return null; }
  }

  // helper to perform idempotent copy (source -> dest)
  function copyIfMissing(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) return false; // already exists
    fs.copyFileSync(src, dest);
    return true;
  }
  const raw = JSON.parse(fs.readFileSync(filePath,'utf8'));
  console.log('# Dry-run: apply human decisions');
  console.log('File:', filePath);
  console.log('BatchId:', raw.batchId || 'N/A');
  console.log('Reviewer:', raw.reviewer || 'N/A');
  console.log('Entries:', (raw.decisions||[]).length);
  console.log('---');

  let counts = { trash: 0, route: 0, hold: 0 };
  for (const d of (raw.decisions||[])) {
    const filename = d.filename;
    const decision = d.decision || (d.final_route === 'TRASH' ? 'discard' : 'unknown');
    const finalRoute = d.final_route || null;
    const note = d.human_reason || '';
    if (decision === 'discard' || (finalRoute && finalRoute.toUpperCase() === 'TRASH')) {
      counts.trash++;
      console.log(`TRASH  : ${filename}  -> mark as TRASH (note: ${note})`);
      if (doApply) {
        const src = findSourceFile(filename);
        if (!src) { console.log('  [apply] source not found, skipping'); continue; }
        const destDir = path.join(NAVI_ROOT, 'archive', 'trash');
        fs.mkdirSync(destDir, { recursive: true });
        const dest = path.join(destDir, filename);
        if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
        try { fs.unlinkSync(src); } catch(e) {}
        console.log(`  [apply] moved to ${dest}`);
      }
      continue;
    }
    if (decision === 'hold') {
      counts.hold++;
      console.log(`HOLD   : ${filename}  -> keep in HOLD (note: ${note})`);
      continue;
    }
    if (finalRoute) {
      counts.route++;
      const targets = getTargetsForRoute(finalRoute, cfg);
      console.log(`ROUTE  : ${filename}  -> ${finalRoute}`);
      console.log(`         storage: ${targets.storage || '(no route_paths entry)'} `);
      console.log(`         office : ${targets.officeInbox || '(no office mapping)'} `);
      if (doApply) {
        const src = findSourceFile(filename);
        if (!src) { console.log('  [apply] source not found, skipping'); continue; }
        if (targets.storage) {
          fs.mkdirSync(path.dirname(targets.storage), { recursive: true });
          if (!fs.existsSync(targets.storage)) fs.copyFileSync(src, targets.storage);
          try { fs.unlinkSync(src); } catch(e) {}
          console.log(`  [apply] canonical: ${targets.storage}`);
        }
        if (targets.officeInbox) {
          fs.mkdirSync(targets.officeInbox, { recursive: true });
          const officeItem = path.join(targets.officeInbox, filename);
          if (!fs.existsSync(officeItem)) fs.copyFileSync(targets.storage || src, officeItem);
          console.log(`  [apply] office copy: ${officeItem}`);
        }
      }
      continue;
    }
    console.log(`SKIP   : ${filename}  -> no final_route/decision`);
  }

  console.log('---');
  console.log('Summary:', counts);
  if (!doApply) console.log('\nNote: this was a dry-run. Re-run with --apply to actually perform actions.');
}

main().catch(err => { console.error('ERROR', err); process.exit(1); });
