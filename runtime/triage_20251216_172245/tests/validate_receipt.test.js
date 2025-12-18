// Receipt validator (Node.js) using AJV
const fs = require('fs');
const path = require('path');

const receiptPath = process.argv[2] || path.join(__dirname, 'sample.receipt.json');
const schemaPath = path.join(__dirname, '..', '..', '..', 'docs', 'receipt.schema.json');

if (!fs.existsSync(receiptPath)) { console.error('Receipt not found:', receiptPath); process.exit(2); }
if (!fs.existsSync(schemaPath)) { console.error('Schema not found:', schemaPath); process.exit(2); }

const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

try {
  const Ajv = require('ajv');
  const ajv = new Ajv({ allErrors: true });
  require('ajv-formats')(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(receipt);
  if (!valid) {
    console.error('Receipt validation failed:', JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }
  console.log('Receipt validation succeeded');
  process.exit(0);
} catch (e) {
  console.error('AJV or AJV-FORMATS missing. Install: npm install ajv ajv-formats');
  process.exit(2);
}
