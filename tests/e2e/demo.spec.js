const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/design-approval.html`;

test.describe('Demo UX flow (e2e)', () => {
  test('walk through demo mode', async ({ page }) => {
    await page.goto(BASE);
    await page.click('#btnDemoToggle');
    // Fill name
    await page.fill('#signatureName', 'E2E User');
    // Add notes
    await page.fill('#approvalNotes', 'E2E test notes');
    // Submit approval
    await page.click('#btnApprove');
    // Expect toast
    const toast = await page.waitForSelector('#toast', { state: 'visible' });
    expect(await toast.textContent()).toContain('Demo: Approval submitted');
    // Check demo checklist shows completed steps
    const completed = await page.$$eval('#demoChecklist li.complete', els => els.length);
    expect(completed).toBeGreaterThanOrEqual(2);
  });
});