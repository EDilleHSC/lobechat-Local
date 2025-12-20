const request = require('supertest');
const express = require('express');
const { makeHandler } = require('../../src/approval-handler');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('audit.err.log behavior on write failure', () => {
  let tmpDir, logDir, app;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'approval-err-'));
    logDir = path.join(tmpDir, 'NAVI', 'approvals');
    app = express();
    app.use(express.json());
    app.post('/approval', makeHandler({ logDir }));
  });

  afterEach(async () => {
    try { await fs.promises.rm(tmpDir, { recursive: true, force: true }); } catch (e) { }
    jest.restoreAllMocks();
  });

  test('writes audit.err.log when audit.log append fails', async () => {
    // Spy on appendFile to fail the first call (audit.log) and succeed the second (audit.err.log)
    const appendSpy = jest.spyOn(fs.promises, 'appendFile')
      .mockImplementationOnce(() => Promise.reject(new Error('simulated disk failure')))
      .mockImplementation(() => Promise.resolve());

    const res = await request(app)
      .post('/approval')
      .send({ approvedBy: 'Fault Tester', status: 'Track', snapshot: 'Err_Snap' });

    // Expect the handler to surface a server error because the first write failed
    expect(res.status).toBe(500);

    // Ensure appendFile was called at least twice (audit.log attempt, audit.err.log write)
    expect(appendSpy).toHaveBeenCalled();
    expect(appendSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    const firstPath = appendSpy.mock.calls[0][0];
    const secondPath = appendSpy.mock.calls[1][0];

    expect(path.basename(firstPath)).toBe('audit.log');
    expect(path.basename(secondPath)).toBe('audit.err.log');

    // Check the error entry contains the expected fields
    // Since appendFile is mocked, the error entry was not written to disk; verify the mocked call arguments contain the expected error text and payload
    const errCallContent = appendSpy.mock.calls[1][1];
    expect(errCallContent).toContain('simulated disk failure');
    expect(errCallContent).toContain('Fault Tester');
  });
});