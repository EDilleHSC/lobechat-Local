const fs = require('fs');
const path = require('path');

const presenterPath = path.resolve(__dirname, '..', '..', '..', 'NAVI', 'presenter', 'generated', 'presenter.json');

if (!fs.existsSync(presenterPath)) {
  console.error('[ERROR] presenter.json not found at', presenterPath);
  process.exit(2);
}

const raw = fs.readFileSync(presenterPath, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('[ERROR] presenter.json is not valid JSON:', e.message);
  process.exit(3);
}

if (!data.trust_header || !data.trust_header.rendered_at) {
  console.error('[ERROR] presenter.json missing trust_header.rendered_at');
  process.exit(4);
}

if (!Array.isArray(data.items)) {
  console.error('[ERROR] presenter.json items missing or not an array');
  process.exit(5);
}

if (typeof data.trust_header.items_processed === 'number') {
  if (data.items.length !== data.trust_header.items_processed) {
    console.error('[ERROR] presenter.json items length does not match trust_header.items_processed');
    process.exit(6);
  }
}

// Ensure each item has required fields (filename and checksum or meta_path)
for (let i = 0; i < data.items.length; i++) {
  const item = data.items[i];
  if (!item.filename || typeof item.filename !== 'string') {
    console.error('[ERROR] presenter.json item missing filename at index', i);
    process.exit(7);
  }
  if (!item.checksum_sha256 && !item.meta_path) {
    console.error('[ERROR] presenter.json item missing checksum_sha256 and meta_path at index', i);
    process.exit(8);
  }
}

console.log('[OK] presenter.json is present and contains trust_header + items');
process.exit(0);
