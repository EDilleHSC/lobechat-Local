const fs = require('fs').promises;
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

console.log('Approval handler module loaded');

const LOG_DIR_DEFAULT = path.join(__dirname, '..', 'NAVI', 'approvals');
const APPROVAL_DIR_DEFAULT = path.join(__dirname, '..', 'NAVI', 'approvals');
const SCHEMA_PATH = path.resolve(__dirname, '..', 'schemas', 'approval.schema.json');

let ajv;
let validate;

async function loadSchema() {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    const schemaContent = await fs.readFile(SCHEMA_PATH, 'utf8');
    const schema = JSON.parse(schemaContent);
    validate = ajv.compile(schema);
  }
}

function makeHandler({ logDir = LOG_DIR_DEFAULT, approvalDir = APPROVAL_DIR_DEFAULT, requiredToken = process.env.MCP_APPROVAL_TOKEN } = {}) {
  async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
  }

  return async function approvalHandler(req, res) {
    try {
      console.log('Loading schema...');
      await fs.appendFile('debug.log', 'Loading schema...\n');
      await loadSchema();
      console.log('Schema loaded');
      await fs.appendFile('debug.log', 'Schema loaded\n');

      const token = req.headers['x-mcp-approval-token'];
      if (requiredToken && token !== requiredToken) {
        return res.status(403).json({ error: 'Invalid approval token' });
      }

      const payload = req.body;
      console.log('Validating payload:', JSON.stringify(payload, null, 2));
      await fs.appendFile('debug.log', 'Validating payload\n');
      if (!validate(payload)) {
        const errors = validate.errors.map(e => `${e.instancePath} ${e.message}`).join('; ');
        console.log('Validation errors:', errors);
        await fs.appendFile('debug.log', 'Validation errors: ' + errors + '\n');
        return res.status(400).json({ error: `Invalid payload: ${errors}` });
      }
      console.log('Payload valid');
      await fs.appendFile('debug.log', 'Payload valid\n');

      await ensureDir(approvalDir);

      const { reviewer, status, snapshot_id, timestamp, items } = payload;
      const dateDir = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const approvalDirPath = path.join(approvalDir, dateDir);
      await ensureDir(approvalDirPath);

      const approvalFile = `${snapshot_id}.approval.json`;
      const approvalPath = path.join(approvalDirPath, approvalFile);
      await fs.writeFile(approvalPath, JSON.stringify(payload, null, 2), 'utf8');
      console.log('Approval file written to:', approvalPath);
      await fs.appendFile('debug.log', 'Approval file written to: ' + approvalPath + '\n');

      // Append to audit log
      const auditLine = `[${new Date().toISOString()}] ${reviewer} approved snapshot ${snapshot_id} with ${items.length} items\n`;
      const auditPath = path.join(logDir, 'audit.log');
      await fs.appendFile(auditPath, auditLine, 'utf8');
      console.log('Audit log updated');
      await fs.appendFile('debug.log', 'Audit log updated\n');

      return res.status(201).json({ ok: true, file: approvalPath });
    } catch (err) {
      console.error('Failed to process approval:', err);
      await fs.appendFile('debug.log', 'Error: ' + err.message + '\n');
      return res.status(500).json({ error: 'Could not process approval' });
    }
  };
}

module.exports = { makeHandler };
