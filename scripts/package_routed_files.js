'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

function safeWriteFileAtomic(filePath, content) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, { encoding: 'utf8' });
  fs.renameSync(tmp, filePath);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val);
}

function packageRoutedFiles({ routeFolder, packagesRoot, limit = 0, zip = false } = {}) {
  routeFolder = routeFolder || path.join(__dirname, '..', 'NAVI', 'HOLDING', 'review', 'unknown');
  packagesRoot = packagesRoot || path.join(__dirname, '..', 'NAVI', 'packages');

  ensureDir(packagesRoot);
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:]/g, '-').replace(/T/, '_').split('.')[0];
  const pkgDir = path.join(packagesRoot, `package_${timestamp}`);
  ensureDir(pkgDir);

  const allFiles = fs.readdirSync(routeFolder).filter(f => !f.endsWith('.navi.json') && !f.endsWith('.meta.json'))
    .map(f => ({ name: f, full: path.join(routeFolder, f), mtime: fs.statSync(path.join(routeFolder, f)).mtime }))
    .sort((a,b) => a.mtime - b.mtime);

  const files = (limit && limit > 0) ? allFiles.slice(0, limit) : allFiles;
  const manifest = [];

  files.forEach(f => {
    const base = f.full;
    const navi = path.join(routeFolder, f.name + '.navi.json');
    const meta = path.join(routeFolder, f.name + '.meta.json');

    let alreadyPackaged = false;
    if (fs.existsSync(navi)) {
      try {
        const raw = fs.readFileSync(navi, 'utf8');
        const j = JSON.parse(raw);
        if (isObject(j) && j.packaged === true) alreadyPackaged = true;
      } catch (e) { /* ignore */ }
    }

    if (alreadyPackaged) return;

    // copy main file
    fs.copyFileSync(base, path.join(pkgDir, f.name));
    if (fs.existsSync(navi)) fs.copyFileSync(navi, path.join(pkgDir, f.name + '.navi.json'));
    if (fs.existsSync(meta)) fs.copyFileSync(meta, path.join(pkgDir, f.name + '.meta.json'));

    // update navi safely
    if (fs.existsSync(navi)) {
      try {
        const raw = fs.readFileSync(navi, 'utf8');
        let j;
        let parseError = false;
        try { j = JSON.parse(raw); } catch (err) { parseError = true; j = raw; }

        if (isObject(j) && !parseError) {
          // try to set packaged
          try {
            j.packaged = true;
            safeWriteFileAtomic(navi, JSON.stringify(j, null, 2));
            safeWriteFileAtomic(path.join(pkgDir, f.name + '.navi.json'), JSON.stringify(j, null, 2));
          } catch (err) {
            // fallback: create merged object
            try {
              const merged = Object.assign({}, j, { packaged: true });
              safeWriteFileAtomic(navi, JSON.stringify(merged, null, 2));
              safeWriteFileAtomic(path.join(pkgDir, f.name + '.navi.json'), JSON.stringify(merged, null, 2));
            } catch (err2) {
              // cannot write original; write wrapper only in package
              const wrapper = { packaged: true, note: 'could not modify original .navi.json; wrapper created' };
              safeWriteFileAtomic(path.join(pkgDir, f.name + '.navi.json'), JSON.stringify(wrapper, null, 2));
            }
          }
        } else {
          // original is primitive/array or parse failed: write wrapper into package
          const wrapper = { packaged: true, note: 'original .navi.json had non-object shape or invalid JSON; original left unchanged', original_shape: (parseError ? 'invalid_json' : typeof j) };
          safeWriteFileAtomic(path.join(pkgDir, f.name + '.navi.json'), JSON.stringify(wrapper, null, 2));
        }
      } catch (err) {
        // ensure wrapper exists
        const wrapper = { packaged: true, note: 'error while processing original .navi.json; wrapper created' };
        safeWriteFileAtomic(path.join(pkgDir, f.name + '.navi.json'), JSON.stringify(wrapper, null, 2));
      }
    }

    manifest.push({ filename: f.name, route: 'mail_room.review_required', applied_at: f.mtime.toISOString(), navi: fs.existsSync(path.join(pkgDir, f.name + '.navi.json')) ? path.join(pkgDir, f.name + '.navi.json') : '', meta: fs.existsSync(path.join(pkgDir, f.name + '.meta.json')) ? path.join(pkgDir, f.name + '.meta.json') : '', packaged_at: now.toISOString() });
  });

  // manifest.csv
  const manifestPath = path.join(pkgDir, 'manifest.csv');
  const csv = ['filename,route,applied_at,navi,meta,packaged_at'];
  manifest.forEach(m => csv.push([m.filename, m.route, m.applied_at, m.navi, m.meta, m.packaged_at].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')));
  safeWriteFileAtomic(manifestPath, csv.join('\n'));

  // README
  const readme = [`# NAVI Package - ${timestamp}`, '', `Created: ${now.toISOString()}`, '', `Files packaged: ${manifest.length}`, '', '## Contents', ''];
  manifest.forEach(m => readme.push(`- ${m.filename} — ${m.route} — applied_at: ${m.applied_at}`));
  safeWriteFileAtomic(path.join(pkgDir, 'README.md'), readme.join('\n'));

  // optionally zip - left as TODO
  return { pkgDir, manifest };
}

if (require.main === module) {
  // CLI
  const args = require('minimist')(process.argv.slice(2));
  const routeFolder = args['routeFolder'] || args['r'];
  const packagesRoot = args['packagesRoot'] || args['p'];
  const limit = args['limit'] ? parseInt(args['limit'], 10) : 0;
  const res = packageRoutedFiles({ routeFolder, packagesRoot, limit, zip: !!args.zip });
  console.log('Package created:', res.pkgDir);
}

module.exports = { packageRoutedFiles };
