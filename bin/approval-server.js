#!/usr/bin/env node
const express = require('express');
const path = require('path');
const { makeHandler } = require('../src/approval-handler');

const PORT = process.env.PORT || 8005;
const app = express();
app.use(express.json());

// Serve static files from NAVI/presenter under the /presenter route (match dev_server)
app.use('/presenter', express.static(path.join(__dirname, '..', 'NAVI', 'presenter')));

app.post('/approval', (req, res) => {
  console.log('POST /approval received');
  const handler = makeHandler();
  handler(req, res);
});

// Expose audit endpoint in the main approval server too
const { parseAudit } = require('../src/approval-audit');
app.get('/approvals/audit', async (req, res) => {
  try {
    const entries = await parseAudit();
    res.json(entries);
  } catch (e) {
    res.status(500).json({ error: 'could not read audit log' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Approval server listening on http://localhost:${PORT}`);
});
