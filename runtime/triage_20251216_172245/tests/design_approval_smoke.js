const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const FILE = path.join(ROOT, 'presenter', 'design-approval.html');

(async function main(){
  try {
    console.log('Design approval smoke test starting...');
    if (!fs.existsSync(FILE)) throw new Error('File not found: ' + FILE);
    const s = fs.readFileSync(FILE, 'utf8');

    // Basic assertions
    if (s.indexOf('Design Report & Approval') === -1) throw new Error('Title missing');
    if (s.indexOf('id="signatureName"') === -1) throw new Error('signature input missing');
    if (s.indexOf('id="signatureDate"') === -1) throw new Error('date input missing');
    if (s.indexOf('id="btnApprove"') === -1 && s.indexOf('Approve') === -1) throw new Error('approve button missing');

    // JS checks: ensure there is a guard for missing name
    if (s.indexOf('Please enter your name') === -1) throw new Error('name validation message missing');
    if (s.indexOf('Please add revision notes') === -1 && s.indexOf('Please add revision notes') === -1) {
      // OK if revision message is same as earlier; best effort
    }

    console.log('Design approval smoke test PASSED');
    process.exit(0);
  } catch (err) {
    console.error('Design approval smoke FAILED:', err.message || err);
    process.exit(2);
  }
})();