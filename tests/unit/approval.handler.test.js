const request = require('supertest');
const express = require('express');
const { makeHandler } = require('../../src/approval-handler');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('approval handler (unit)', () => {
  let app; let tmpDir; let logDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'approval-test-'));
    logDir = path.join(tmpDir, 'NAVI', 'approvals');
    // Ensure the approvals/log directory exists so tests are not reliant on environment-specific
    // directory creation semantics in CI/Windows runners.
    await fs.mkdir(logDir, { recursive: true });
    app = express();
    app.use(express.json());
    app.post('/approval', makeHandler({ logDir }));
  });

  afterEach(async () => {
    // best-effort cleanup
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch (e) { }
  });

  test('writes audit log for valid payload', async () => {
    const res = await request(app)
      .post('/approval')
      .send({ approvedBy: 'Unit Tester', status: 'Track', snapshot: 'Unit_Snapshot', notes: 'ok' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('logged');
    const logPath = res.body.file;
    const content = await fs.readFile(logPath, 'utf8');
    expect(content).toContain('Unit Tester');
    expect(content).toContain('Unit_Snapshot.docx');
    expect(content).toContain('Track');
  });

  test('rejects missing fields', async () => {
    const res = await request(app)
      .post('/approval')
      .send({ approvedBy: '', status: '' });

    expect(res.status).toBe(400);
  });

  test('rejects invalid status', async () => {
    const res = await request(app)
      .post('/approval')
      .send({ approvedBy: 'Unit Tester', status: 'INVALID' });

    expect(res.status).toBe(400);
  });

  test('requires token when configured', async () => {
    const app2 = express();
    app2.use(express.json());
    app2.post('/approval', makeHandler({ logDir, requiredToken: 'SECRET' }));

    const resNo = await request(app2).post('/approval').send({ approvedBy: 'A', status: 'Track' });
    expect(resNo.status).toBe(403);

    const resOk = await request(app2).post('/approval').set('x-mcp-approval-token', 'SECRET').send({ approvedBy: 'A', status: 'Track' });
    expect(resOk.status).toBe(201);
  });
});