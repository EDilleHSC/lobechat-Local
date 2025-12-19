const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}`;
const TOKEN = process.env.MCP_APPROVAL_TOKEN;

// Skip the whole suite when no token is provided (safe default for CI/dev)
test.skip(!TOKEN, 'MCP_APPROVAL_TOKEN not set - skipping real approval integration tests');

test.describe('Approval integration (real POST) — gated by MCP_APPROVAL_TOKEN', () => {
  test('POST /approval persists a file and audit contains entry', async ({ request }) => {
    const payload = {
      approvedBy: 'E2E Real',
      date: new Date().toISOString(),
      role: 'Automation Test',
      notes: 'Integration test approval',
      checklist: { layout: true, accessibility: true, bugFixed: false, production: false },
      status: 'approved'
    };

    const res = await request.post(`${BASE}/approval`, {
      headers: { 'Content-Type': 'application/json', 'X-MCP-APPROVAL-TOKEN': TOKEN },
      data: payload
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('file');
    expect(body.file).toMatch(/NAVI\/approvals\/.*\.approval\.json$/);

    // Verify audit log contains the filename (GET /approvals/audit returns plain text)
    const audit = await request.get(`${BASE}/approvals/audit`);
    expect(audit.status()).toBe(200);
    const text = await audit.text();
    expect(text).toContain(body.file.split(/\\|\//).pop());
  });
});
