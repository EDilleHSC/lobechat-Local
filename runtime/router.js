const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_DIR = path.join(ROOT, 'NAVI', 'snapshots', 'inbox');
const INBOX_DIR = path.join(ROOT, 'NAVI', 'inbox');
const AGENT_BASE = path.join(ROOT, 'NAVI', 'agents');

function latestSnapshot() {
  if (!fs.existsSync(SNAPSHOT_DIR)) return null;
  const files = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json'));
  if (!files.length) return null;
  files.sort();
  return path.join(SNAPSHOT_DIR, files[files.length - 1]);
}

function sha256File(filepath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filepath);
  hash.update(data);
  return hash.digest('hex');
}

function route() {
  const snapPath = latestSnapshot();
  if (!snapPath) {
    console.log(JSON.stringify({ routed_to: null, routed_files: [], snapshot: null }));
    return 0;
  }
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  const routed = [];

  for (const item of snap.items || []) {
    const name = item.name;
    const src = path.join(INBOX_DIR, name);
    if (!fs.existsSync(src)) continue;

    // Simple routing rule: all files -> agent1
    const agent = 'agent1';
    const agentInbox = path.join(AGENT_BASE, agent, 'inbox');
    fs.mkdirSync(agentInbox, { recursive: true });

    const dst = path.join(agentInbox, name);
    fs.copyFileSync(src, dst);

    const checksum = sha256File(dst);

    const meta = {
      filename: name,
      routing_id: crypto.randomUUID(),
      routed_from: INBOX_DIR,
      snapshot_id: path.basename(snapPath),
      routed_at: new Date().toISOString(),
      routed_to: agent,
      checksum_sha256: checksum,
      trust_header: path.basename(snapPath),
      rules_applied: ["default-route-agent1"]
    };

    const metaPath = dst + '.meta.json';
    const metaTmp = metaPath + '.tmp';
    fs.writeFileSync(metaTmp, JSON.stringify(meta, null, 2), 'utf8');
    fs.renameSync(metaTmp, metaPath);
    console.info(`[ROUTER] Wrote meta: ${metaPath}`);

    routed.push(name);
  }

  console.log(`[ROUTER] Completed: routed ${routed.length} files to agent1 (snapshot=${path.basename(snapPath)})`);
  const out = { routed_to: 'agent1', routed_files: routed, snapshot: path.basename(snapPath), timestamp: new Date().toISOString() };
  // Emit structured JSON with a distinct prefix so machines can reliably parse it.
  console.log('[ROUTER_JSON]', JSON.stringify(out));
  return 0;
}

if (require.main === module) {
  process.exit(route());
}
