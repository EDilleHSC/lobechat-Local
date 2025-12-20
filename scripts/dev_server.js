const express = require('express');
const path = require('path');
const { makeHandler } = require('../src/approval-handler');

const PORT = process.env.PORT || 8005;
const app = express();
app.use(express.json());
app.use('/presenter', express.static(path.join(__dirname, '..', 'NAVI', 'presenter')));
app.post('/approval', makeHandler());

// Audit endpoint returns parsed audit log entries as JSON (new)
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
  console.log(`Dev server listening on http://localhost:${PORT}`);
});
