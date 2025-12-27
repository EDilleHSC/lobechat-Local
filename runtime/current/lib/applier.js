const fs = require('fs').promises;
const path = require('path');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * applyRoute(opts): Applies routing decision by moving file and sidecar to appropriate location,
 * and writing a meta file with applied details.
 * opts: { srcPath, sidecarPath, route, autoRoute, dryRun, routingMeta, config }
 * Returns: { applied: boolean, destPath, metaPath }
 */
module.exports.applyRoute = async function applyRoute(opts) {
  const { srcPath, sidecarPath, route, routingMeta = {}, config = {} } = opts;
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const naviRoot = (config && config.navi_root) ? config.navi_root : (process.env.NAVI_ROOT || path.join(projectRoot, 'NAVI'));

  // Determine destination based on route and routingMeta
  let destDir;
  // Prefer explicit routed_to if provided
  if (routingMeta && routingMeta.routed_to) {
    destDir = path.join(naviRoot, 'agents', routingMeta.routed_to, 'inbox');
  } else if (/agent\d+/.test(route)) {
    // route like agent1
    const agent = route.match(/(agent\d+)/)[1];
    destDir = path.join(naviRoot, 'agents', agent, 'inbox');
  } else if (route && route.startsWith('mail_room.duplicate')) {
    destDir = path.join(naviRoot, 'HOLDING', 'duplicates', routingMeta.snapshot_id || 'unknown');
  } else if (route && route.includes('review_required')) {
    destDir = path.join(naviRoot, 'HOLDING', 'review', routingMeta.snapshot_id || 'unknown');
  } else if (route && route.startsWith('rejected') || route.includes('rejected')) {
    destDir = path.join(naviRoot, 'rejected', routingMeta.snapshot_id || new Date().toISOString().slice(0,10));
  } else {
    // default: processed by snapshot
    destDir = path.join(naviRoot, 'processed', routingMeta.snapshot_id || new Date().toISOString().slice(0,10));
  }

  await ensureDir(destDir);

  const filename = path.basename(srcPath);
  const destPath = path.join(destDir, filename);

  // Move file
  await fs.rename(srcPath, destPath);

  // Move sidecar if exists
  let destSidecar = null;
  if (sidecarPath && (await exists(sidecarPath))) {
    destSidecar = destPath + '.navi.json';
    await fs.rename(sidecarPath, destSidecar);
  }

  // Write meta file
  let meta = {
    filename: filename,
    routed_from: path.relative(naviRoot, path.dirname(srcPath)),
    routed_to: path.relative(naviRoot, destDir),
    applied_at: new Date().toISOString(),
    route: route,
    routingMeta: routingMeta
  };
  const metaPath = destPath + '.meta.json';
  await fs.writeFile(metaPath + '.tmp', JSON.stringify(meta, null, 2), 'utf8');
  await fs.rename(metaPath + '.tmp', metaPath);

  // If this route targets an OFFICE (e.g., CFO, CLO, CTO, EXEC), assemble package and deliver
  try {
    const officeMatch = typeof route === 'string' && /^[A-Z]{3,4}$/.test(route);
    if (officeMatch) {
      const { assemblePackage } = require('./package');
      // pass repository root (parent of NAVI root) as naviRoot so package uses correct NAVI/packages under test/alt roots
      const repoRoot = path.resolve(naviRoot, '..');
      const relFiles = [path.relative(repoRoot, destPath)];
      const pkgResult = await assemblePackage({ office: route, files: relFiles, naviRoot: repoRoot });

      // copy package to office inbox
      const officeInbox = path.join(naviRoot, 'offices', route, 'inbox');
      await ensureDir(officeInbox);
      const destPkgPath = path.join(officeInbox, path.basename(pkgResult.packagePath));
      // copy recursively
      await fs.cp(pkgResult.packagePath, destPkgPath, { recursive: true });

      // update sidecar inside package to include batch info
      const sidecarName = path.basename(destSidecar || (destPath + '.navi.json'));
      const sidecarInPackage = path.join(pkgResult.packagePath, sidecarName);
      try {
        const raw = await fs.readFile(sidecarInPackage, 'utf8');
        const sc = JSON.parse(raw);
        if (!sc.routing) sc.routing = {};
        sc.routing.batch_id = pkgResult.batchSeq;
        sc.routing.package = pkgResult.packageName;
        sc.routing.routed_at = new Date().toISOString();
        await fs.writeFile(sidecarInPackage + '.tmp', JSON.stringify(sc, null, 2), 'utf8');
        await fs.rename(sidecarInPackage + '.tmp', sidecarInPackage);
      } catch (err) {
        // ignore if sidecar missing or not JSON
      }

      // update meta with package info
      meta.package = pkgResult.packageName;
      meta.batch_id = pkgResult.batchSeq;
      await fs.writeFile(metaPath + '.tmp', JSON.stringify(meta, null, 2), 'utf8');
      await fs.rename(metaPath + '.tmp', metaPath);

      // remove original moved file and sidecar (they are copied into package)
      try { await fs.unlink(destPath); } catch (e) {}
      try { if (destSidecar) await fs.unlink(destSidecar); } catch (e) {}

      return { applied: true, package: pkgResult.packageName, packagePath: pkgResult.packagePath, delivered_to: destPkgPath, metaPath };
    }
  } catch (err) {
    // non-fatal: log and surface error for diagnostics; fallback to simple move
    console.error(`[APPLIER] assemblePackage failed for ${route}:`, err && err.message ? err.message : err);
  }

  return { applied: true, destPath, metaPath, sidecar: destSidecar };
};

async function exists(p) {
  try { await fs.access(p); return true; } catch (e) { return false; }
}
