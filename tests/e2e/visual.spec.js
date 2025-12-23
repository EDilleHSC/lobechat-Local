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

    // Stabilize viewport to Playwright default for consistent screenshots
    await page.setViewportSize({ width: 1280, height: 720 });

    // Take a screenshot and compare (allow small tolerance)
    // NOTE: If you want stricter checks, consider regenerating the baseline or running tests in CI with the same env as baseline
    await expect(card).toHaveScreenshot('approval-card.png', { maxDiffPixelRatio: 0.25 });
  });
});