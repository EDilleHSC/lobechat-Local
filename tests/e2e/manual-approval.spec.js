const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/design-approval.html`;

test.describe('Manual Approval UI (e2e)', () => {
  test('shows disabled submit while request in-flight and announces success', async ({ page }) => {
    await page.goto(BASE);

    // Stub POST /approval with a small delay to assert disabled state
    await page.route('**/approval', async route => {
      await new Promise(r => setTimeout(r, 300));
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ file: 'NAVI/approvals/e2e.json' }) });
    });

    await page.fill('[data-testid="token-input"]', 'test-token');
    await page.fill('[data-testid="approvedBy-input"]', 'E2E Tester');
    await page.click('[data-testid="check-layout"]');

    // Click submit and immediately check button disabled
    await page.click('[data-testid="submit-approval"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="submit-approval"]').disabled === true);

    // Wait for success announcement
    const out = page.locator('[data-testid="result"]');
    await out.waitFor({ state: 'visible', timeout: 3000 });
    await expect(out).toContainText('Approval persisted');
  });

  test('shows error message when POST fails', async ({ page }) => {
    await page.route('**/approval', route => route.fulfill({ status: 500, contentType: 'text/plain', body: 'oops' }));
    await page.goto(BASE);

    await page.fill('[data-testid="token-input"]', 'test-token');
    await page.fill('[data-testid="approvedBy-input"]', 'E2E Tester');
    await page.click('[data-testid="submit-approval"]');

    const err = page.locator('[data-testid="error"]');
    await err.waitFor({ state: 'visible', timeout: 3000 });
    await expect(err).toContainText('Approval failed');
  });
});