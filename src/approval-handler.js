const fs = require('fs').promises;
const path = require('path');

const LOG_DIR_DEFAULT = path.join(__dirname, '..', 'NAVI', 'approvals');
const LOG_FILE = 'audit.log';
const ALLOWED_STATUSES = new Set(['Track', 'Hold', 'Escalate']);

function makeHandler({ logDir = LOG_DIR_DEFAULT, requiredToken = process.env.MCP_APPROVAL_TOKEN } = {}) {
  async function ensureDir() {
    await fs.mkdir(logDir, { recursive: true });
  }

  return async function approvalHandler(req, res) {
    try {
      const token = req.headers['x-mcp-approval-token'];
      if (requiredToken && token !== requiredToken) {
        return res.status(403).json({ error: 'Invalid approval token' });
      }

      const {
        approvedBy = 'UNKNOWN',
        status,
        notes = '',
        snapshot = 'UNKNOWN',
        file = 'UNKNOWN_FILE.docx',
      } = req.body || {};

      if (!approvedBy || !status) {
        return res.status(400).json({ error: 'Missing required fields: approvedBy, status' });
      }

      if (!ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({ error: `Invalid status: must be one of ${[...ALLOWED_STATUSES].join(', ')}` });
      }

      await ensureDir();

      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const targetFile = snapshot && snapshot !== 'UNKNOWN' ? `${snapshot}.docx` : file;
      const line = `[${timestamp}] ${approvedBy} marked ${targetFile} → ${status}${notes ? ` — ${notes}` : ''}\n`;

      const logPath = path.join(logDir, LOG_FILE);
      await fs.appendFile(logPath, line, 'utf8');

      // Return the written line and file path for easy assertions
      return res.status(201).json({ ok: true, logged: line.trim(), file: logPath });
    } catch (err) {
      console.error('Failed to write audit log:', err);
      // Attempt to write structured error entry to a separate audit.err.log file for ops
      try {
        const errLine = JSON.stringify({ ts: new Date().toISOString(), err: err && err.message ? err.message : String(err), payload: req && req.body ? req.body : null }) + '\n';
        const errPath = path.join(logDir, 'audit.err.log');
        await fs.appendFile(errPath, errLine, 'utf8');
      } catch (e2) {
        // If even error logging fails, at least log to console
        console.error('Failed to write audit.err.log:', e2);
      }
      return res.status(500).json({ error: 'Could not write audit log' });
    }
  };
}

module.exports = { makeHandler };
