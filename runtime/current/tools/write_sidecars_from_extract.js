const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node write_sidecars_from_extract.js <extract_json_file>');
  process.exit(2);
}
const inFile = process.argv[2];
let data;
try {
  data = JSON.parse(fs.readFileSync(inFile, 'utf8'));
} catch (e) {
  console.error('Failed to read/parse', inFile, e.message);
  process.exit(1);
}

for (const [filePath, text] of Object.entries(data)) {
  try {
    const scPath = filePath + '.navi.json';
    const payload = {
      generated_at: new Date().toISOString(),
      extracted_text_snippet: (text || '').slice(0, 16000)
    };
    fs.writeFileSync(scPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log('Wrote sidecar:', scPath);
  } catch (e) {
    console.error('Failed for', filePath, e.message);
  }
}
