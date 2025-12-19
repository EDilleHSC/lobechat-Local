const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/design-approval.html`;

test.describe('Visual: Approval card', () => {
  test('approval card matches baseline', async ({ page }) => {
    await page.goto(BASE);
    // Normalize dynamic content so snapshot is stable
    await page.evaluate(() => {
      const s = document.getElementById('snapshot'); if (s) s.textContent = 'SNAPSHOT-PLACEHOLDER';
      const out = document.getElementById('result'); if (out) out.style.display = 'none';
      // Hide focus outlines for deterministic render
      document.body.classList.add('pw-visual-test');
    });

    // Wait for the card to be visible
    const card = page.locator('.file-card');
    await expect(card).toBeVisible();

    // Take a screenshot and compare
    await expect(card).toHaveScreenshot('approval-card.png', { maxDiffPixelRatio: 0.01 });
  });
});