// Lightweight router CLI used by mcp_server to produce routing suggestions
const fs = require('fs');
const path = require('path');
const { decideRoute } = require('./lib/router');
const { writeSidecar } = require('./lib/sidecar');

// PROJECT_ROOT should point to repo root (two levels up from runtime/current)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const NAVI_CONFIG_PATH = path.join(PROJECT_ROOT, 'NAVI', 'config', 'routing_config.json');
let routingConfig = {};
try { routingConfig = JSON.parse(fs.readFileSync(NAVI_CONFIG_PATH, 'utf8')); } catch(e) { /* continue */ }

const NAVI_ROOT = process.env.NAVI_ROOT || routingConfig.navi_root || path.join(PROJECT_ROOT, 'NAVI');
const INBOX_DIR = path.join(NAVI_ROOT, 'inbox');

function sampleText(file) {
  try {
    const ext = path.extname(file).toLowerCase();
    // For text files, return content
    if (ext === '.txt' || ext === '.md') return fs.readFileSync(file, 'utf8').slice(0, 4096);

    // For PDFs and binaries, try to read a small raw buffer and coerce to text
    const buf = fs.readFileSync(file, { encoding: null, flag: 'r' });
    const text = buf.toString('utf8', 0, Math.min(buf.length, 16000)).replace(/\0/g, ' ');
    // Normalize whitespace and return a safe snippet
    return text.replace(/\s+/g, ' ').trim().slice(0, 8192);
  } catch (e) {
    // Fallback: filename
  }
  return path.basename(file);
}

const files = fs.existsSync(INBOX_DIR) ? fs.readdirSync(INBOX_DIR).map(f => path.join(INBOX_DIR, f)).filter(p => fs.statSync(p).isFile() && !p.toLowerCase().endsWith('.navi.json')) : [];
const out = { routed_files: [], routed_to: {}, timestamp: new Date().toISOString() };
const { spawnSync } = require('child_process');

for (const f of files) {
  // If a sidecar exists and contains extracted text or detectedEntities, prefer it
  const sidecarPath = f + '.navi.json';
  let extractedText = null;
  let detectedEntities = [];
  try {
    if (fs.existsSync(sidecarPath)) {
      const sc = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
      if (sc && sc.extracted_text_snippet) extractedText = sc.extracted_text_snippet;
      if (sc && Array.isArray(sc.detectedEntities) && sc.detectedEntities.length>0) detectedEntities = sc.detectedEntities;
    }
  } catch (e) {
    // ignore and continue
  }

  if (!extractedText) extractedText = sampleText(f);

  // If we still don't have detectedEntities, try to call the helper detector to get candidates
  if ((!detectedEntities || detectedEntities.length===0) && extractedText && extractedText.length>10) {
    try {
      const detector = path.join(__dirname, 'tools', 'detect_entity_cli.js');
      const r = spawnSync('node', [detector], { input: extractedText, encoding: 'utf8', maxBuffer: 10*1024*1024 });
      if (r.status === 0 && r.stdout) {
        const parsed = JSON.parse(r.stdout);
        if (parsed && Array.isArray(parsed.detectedEntities)) detectedEntities = parsed.detectedEntities.map(d => ({ entity: d.entity, confidence: d.confidence }));
      }
    } catch (e) {
      // detector failed; continue
    }
  }

  const item = {
    filename: path.basename(f),
    extractedText: extractedText,
    detectedEntities: detectedEntities
  };

  const decision = decideRoute(item, routingConfig);

  // Add extracted text and detectedEntities to sidecar for auditability
  const scOut = Object.assign({ filename: item.filename, extracted_text_snippet: (item.extractedText||'').slice(0,16000), detectedEntities: item.detectedEntities }, decision);
  const sc = writeSidecar(f, scOut);

  out.routed_files.push({ src: f, route: decision.route, autoRoute: decision.autoRoute, sidecar: sc });
  out.routed_to[decision.route] = (out.routed_to[decision.route] || 0) + 1;
}

console.log(JSON.stringify(out));