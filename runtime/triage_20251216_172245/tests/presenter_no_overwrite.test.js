const fs = require('fs');
const path = require('path');

const presenterPy = path.resolve(__dirname, '..', '..', '..', 'NAVI', 'presenter', 'presenter.py');
const content = fs.readFileSync(presenterPy, 'utf8');

if (content.includes('open(self.output_path')) {
  console.error('[ERROR] presenter.py still writes to self.output_path (may overwrite approved index.html)');
  process.exit(2);
}

console.log('[OK] presenter.py does not write to self.output_path');
process.exit(0);
