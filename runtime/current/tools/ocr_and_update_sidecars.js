#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// PROJECT_ROOT should point to repo root (three levels up from tools)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const NAVI_ROOT = process.env.NAVI_ROOT || path.join(PROJECT_ROOT, 'NAVI');
const INBOX_DIR = path.join(NAVI_ROOT, 'inbox');

const POPPLER_DIR = path.join(__dirname, 'poppler');
const PDFTOPPM = fs.existsSync(path.join(POPPLER_DIR, 'pdftoppm.exe')) ? path.join(POPPLER_DIR, 'pdftoppm.exe') : 'pdftoppm';
const PDFTOCAIRO = fs.existsSync(path.join(POPPLER_DIR, 'pdftocairo.exe')) ? path.join(POPPLER_DIR, 'pdftocairo.exe') : 'pdftocairo';
// Prefer bundled Tesseract if available
const TESSERACT = fs.existsSync('C:/Program Files/Tesseract-OCR/tesseract.exe') ? 'C:/Program Files/Tesseract-OCR/tesseract.exe' : (fs.existsSync('C:/Program Files (x86)/Tesseract-OCR/tesseract.exe') ? 'C:/Program Files (x86)/Tesseract-OCR/tesseract.exe' : 'tesseract');
const DETECTOR = path.join(__dirname, 'detect_entity_cli.js');

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, Object.assign({ encoding: 'utf8', maxBuffer: 50*1024*1024 }, opts));
  return r;
}

function ocrPdfToText(pdfPath) {
  const base = path.basename(pdfPath).replace(/\.[^.]+$/, '');
  const tmp = path.join(__dirname, 'tmp', base + '_' + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  const outPrefix = path.join(tmp, 'page');

  // pdftoppm -png <pdf> outPrefix
  let r = run(PDFTOPPM, ['-png', pdfPath, outPrefix]);
  console.log('  pdftoppm status', r.status, 'stderrLen', r.stderr ? r.stderr.length : 0);
  if (r.status !== 0) {
    // try pdftocairo (prefer local copy)
    r = run(PDFTOCAIRO, ['-png', pdfPath, outPrefix]);
    console.log('  pdftocairo status', r.status, 'stderrLen', r.stderr ? r.stderr.length : 0);
    if (r.status !== 0) {
      console.log('  pdf->image failed for', pdfPath);
      return '';
    }
  }

  // collect generated pngs
  const images = fs.readdirSync(tmp).filter(f => f.toLowerCase().endsWith('.png')).map(f => path.join(tmp, f)).sort();
  console.log('  tmp files:', fs.existsSync(tmp) ? fs.readdirSync(tmp) : 'missing tmp');
  if (images.length === 0) return '';
  let allText = '';
  for (const img of images) {
    const t = run(TESSERACT, [img, 'stdout', '-l', 'eng']);
    console.log('  tesseract ->', img, 'status', t.status || 0, 'stdoutLen', t.stdout ? t.stdout.length : 0, 'stderrLen', t.stderr ? t.stderr.length : 0);
    if (t.status === 0 && t.stdout) {
      allText += t.stdout + '\n';
    }
  }
  // cleanup images
  try { /* leave tmp for debugging */ } catch (e) {}
  return allText.trim().slice(0, 16000);
}

function detectEntitiesFromText(text) {
  const r = run('node', [DETECTOR], { input: text });
  if (r.status === 0 && r.stdout) {
    try {
      const parsed = JSON.parse(r.stdout);
      if (Array.isArray(parsed.detectedEntities)) return parsed.detectedEntities.map(d => ({ entity: d.entity, confidence: d.confidence, matches: d.matches }));
    } catch (e) { }
  }
  return [];
}

function writeSidecar(pdfPath, text, entities) {
  // Defensive: do not write sidecars for sidecar files
  if (pdfPath.toLowerCase().endsWith('.navi.json')) return null;
  const scPath = pdfPath + '.navi.json';
  const payload = Object.assign({ generated_at: new Date().toISOString(), extracted_text_snippet: (text||'').slice(0,16000) }, entities && entities.length>0 ? { detectedEntities: entities } : {});
  fs.writeFileSync(scPath, JSON.stringify(payload, null, 2), 'utf8');
  return scPath;
}

function main() {
  const files = fs.existsSync(INBOX_DIR) ? fs.readdirSync(INBOX_DIR).map(f => path.join(INBOX_DIR, f)).filter(p => {
    if (!fs.statSync(p).isFile()) return false;
    const name = path.basename(p).toLowerCase();
    // Skip any sidecar/auxiliary files
    if (name.includes('.navi.json')) return false;
    return name.endsWith('.pdf') || name.endsWith('.pdf.testcopy');
  }) : [];
  const pdfs = files;
  if (pdfs.length === 0) {
    console.error('No PDFs found in', INBOX_DIR);
    process.exit(2);
  }
  const summary = [];
  for (const pdf of pdfs) {
    process.stdout.write('OCR: ' + path.basename(pdf) + ' ... ');
    const text = ocrPdfToText(pdf);
    const entities = text && text.length>20 ? detectEntitiesFromText(text) : [];
    const sc = writeSidecar(pdf, text, entities);
    summary.push({ pdf, text_len: (text||'').length, sc, entities_detected: entities.length });
    process.stdout.write(`done (len=${(text||'').length}, entities=${entities.length})\n`);
  }

  // Re-run router
  console.log('\nRe-running router dry-run...');
  const router = run('node', [path.join(__dirname, '..', 'router.js')]);
  if (router.status === 0) {
    console.log(router.stdout);
  } else {
    console.error('Router failed:', router.stderr);
  }
}

main();
