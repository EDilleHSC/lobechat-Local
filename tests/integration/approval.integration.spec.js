const request = require('supertest');
const express = require('express');
const { makeHandler } = require('../../src/approval-handler');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const REQUIRED_TOKEN = process.env.MCP_APPROVAL_TOKEN;

if (!REQUIRED_TOKEN) {
  // Skip the whole suite if token not configured
  describe.skip('approval integration (skipped, MCP_APPROVAL_TOKEN not set)', () => {
    test('skipped', () => {});
  });
} else {
  describe('approval integration (requires MCP_APPROVAL_TOKEN)', () => {
    let app; let server; let tmpDir; let logDir; let url;

    beforeAll(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'approval-int-'));
      logDir = path.join(tmpDir, 'NAVI', 'approvals');
      app = express();
      app.use(express.json());
      app.post('/approval', makeHandler({ logDir, requiredToken: REQUIRED_TOKEN }));

      server = app.listen(0);
      const addr = server.address();
      url = `http://127.0.0.1:${addr.port}`;
    });

    afterAll(async () => {
      if (server) server.close();
      try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch (e) { }
    });

    test('writes audit log when token supplied', async () => {
      const res = await request(url)
        .post('/approval')
        .set('x-mcp-approval-token', REQUIRED_TOKEN)
        .send({ approvedBy: 'Integration Tester', status: 'Hold', snapshot: 'Int_Snap' });

      expect(res.status).toBe(201);
      const logPath = res.body.file;
      const content = await fs.readFile(logPath, 'utf8');
      expect(content).toContain('Integration Tester');
      expect(content).toContain('Int_Snap.docx');
      expect(content).toContain('Hold');
    });
  });
}