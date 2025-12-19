const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/design-approval.html`;

test.describe('Accessibility: NAVI approval page', () => {
  test('form elements have accessible labels and snapshot info', async ({ page }) => {
    await page.goto(BASE);

    // Labels and inputs
    await expect(page.locator('label', { hasText: 'Approved by' })).toBeVisible();
    await expect(page.locator('#approvedBy')).toHaveAttribute('placeholder', /Operator/);

    // Snapshot id and copy button
    await expect(page.locator('#snapshot')).toBeVisible();

    // Replace clipboard with a no-op to prevent environment issues
    await page.evaluate(() => {
      window.navigator.clipboard = { writeText: async () => {} };
    });

    await page.click('#copySnapshot');
    await expect(page.locator('#copySnapshot')).toContainText(/Copy|Copied/);
  });

  test('result appears and is readable after submit (stubbed)', async ({ page }) => {
    await page.goto(BASE);

    // Fill token and a required field
    await page.fill('#token', 'test-token');
    await page.fill('#approvedBy', 'A11y User');

    // Stub the network POST so test remains non-destructive
    await page.route('**/approval', route => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ file: 'NAVI/approvals/test.approval.json' })
    }));

    await page.click('button[type=submit]');

    const out = page.locator('#result');
    await expect(out).toBeVisible();
    await expect(out).toContainText('Approval persisted');
  });
});