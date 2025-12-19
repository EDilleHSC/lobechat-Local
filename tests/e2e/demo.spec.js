const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/design-approval.html`;

test.describe('NAVI Approval flow (e2e)', () => {
  test('fill form and show success (stubbed POST)', async ({ page }) => {
    await page.goto(BASE);

    // Basic page smoke checks
    await expect(page.locator('h1')).toContainText('Design Approval');
    await expect(page.locator('#snapshot')).toBeVisible();

    // Fill in token and approval fields
    await page.fill('#token', 'test-token');
    await page.fill('#approvedBy', 'E2E User');
    await page.fill('#role', 'QA');
    await page.check('#cl_layout');
    await page.check('#cl_accessibility');
    await page.fill('#notes', 'E2E test notes');

    // Stub the POST /approval so the test is non-destructive and deterministic
    await page.route('**/approval', route => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ file: 'NAVI/approvals/2025-12-19/test.approval.json' })
    }));

    // Submit approval
    await page.click('button[type=submit]');

    // Expect a success result to be visible and contain persisted file reference
    const out = page.locator('#result');
    await expect(out).toBeVisible();
    await expect(out).toContainText('Approval persisted');
  });
});