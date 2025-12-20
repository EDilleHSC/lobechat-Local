const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/mail-room.html`;

test('Mail Room visual snapshot', async ({ page }) => {
  await page.goto(BASE);
  // Normalize dynamic content
  await page.evaluate(() => { const s = document.getElementById('snapshot-info'); if(s) s.textContent = 'Processed at SNAPSHOT'; window.__TEST_PROMPT='snap'; });
  await page.setViewportSize({ width: 1280, height: 900 });
  const container = page.locator('.container');
  await expect(container).toBeVisible();
  await expect(container).toHaveScreenshot('mailroom.png', { maxDiffPixelRatio: 0.02 });
});