#!/usr/bin/env node
const express = require('express');
const { makeHandler } = require('../src/approval-handler');

const PORT = process.env.PORT || 8005;
const app = express();
app.use(express.json());

app.post('/approval', makeHandler());

app.listen(PORT, () => {
  console.log(`✅ Approval server listening on http://localhost:${PORT}`);
});
