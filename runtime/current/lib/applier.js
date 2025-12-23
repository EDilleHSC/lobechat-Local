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
  const meta = {
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

  return { applied: true, destPath, metaPath, sidecar: destSidecar };
};

async function exists(p) {
  try { await fs.access(p); return true; } catch (e) { return false; }
}
