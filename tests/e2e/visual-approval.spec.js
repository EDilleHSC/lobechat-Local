const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/design-approval.html`;

test('Approval card visual snapshot', async ({ page }) => {
  await page.goto(BASE);
  const card = page.locator('.file-card');
  await expect(card).toBeVisible();
  await expect(card).toHaveScreenshot('approval-card.png', { maxDiffPixelRatio: 0.01 });
});