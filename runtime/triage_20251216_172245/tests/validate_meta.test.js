// Simple validator example (Node.js) using AJV if installed
// Usage: node validate_meta.test.js [path_to_meta.json]

const fs = require('fs');
const path = require('path');

const metaPath = process.argv[2] || path.join(__dirname, 'sample.meta.json');
const schemaPath = path.join(__dirname, '..', '..', '..', 'docs', 'meta.schema.json');
console.log('Using schema path:', schemaPath);

if (!fs.existsSync(metaPath)) {
  console.error('Meta file not found:', metaPath);
  process.exit(2);
}
if (!fs.existsSync(schemaPath)) {
  console.error('Schema file not found:', schemaPath);
  process.exit(2);
}

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

let Ajv;
try {
  Ajv = require('ajv');
} catch (e) {
  console.error('AJV is not installed. Install in CI or locally: npm install ajv');
  console.error('Schema path:', schemaPath);
  console.error('Meta path:', metaPath);
  process.exit(2);
}

const ajv = new Ajv({ allErrors: true });
// load format support (date-time)
try {
  require('ajv-formats')(ajv);
} catch (e) {
  console.error('ajv-formats is not installed. Install with: npm install ajv-formats');
  process.exit(2);
}
const validate = ajv.compile(schema);
const valid = validate(meta);
if (!valid) {
  console.error('Meta validation failed:', JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
console.log('Meta validation succeeded');
process.exit(0);
