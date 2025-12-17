// Simple validator example (Node.js) using AJV if installed
// Usage: node validate_meta.test.js [path_to_meta.json]

const fs = require('fs');
const path = require('path');

const metaPath = process.argv[2] || path.join(__dirname, 'sample.meta.json');
const schemaPath = path.join(__dirname, '..', '..', '..', '..', 'docs', 'meta.schema.json');

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

try {
  const Ajv = require('ajv');
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(meta);
  if (!valid) {
    console.error('Meta validation failed:', validate.errors);
    process.exit(1);
  }
  console.log('Meta validation succeeded');
  process.exit(0);
} catch (e) {
  console.warn('AJV not installed. To run validation install ajv: npm install ajv');
  console.log('Schema path:', schemaPath);
  console.log('Meta path:', metaPath);
  console.log('Example meta content:', JSON.stringify(meta, null, 2));
  process.exit(0);
}
