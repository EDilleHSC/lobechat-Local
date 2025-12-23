#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function run(files) {
  let pdfparse;
  try {
    pdfparse = require('pdf-parse');
  } catch (e) {
    console.error('pdf-parse not available:', e.message);
    process.exit(2);
  }
  const out = {};
  for (const f of files) {
    try {
      const data = fs.readFileSync(f);
      const res = await pdfparse(data);
      out[f] = (res && res.text) ? res.text.slice(0, 16000) : '';
    } catch (e) {
      out[f] = '';
    }
  }
  console.log(JSON.stringify(out));
}

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files || files.length === 0) {
    console.error('Usage: extract_pdf_node.js <file1> [file2]');
    process.exit(2);
  }
  run(files).catch(e => { console.error(e); process.exit(1); });
}
