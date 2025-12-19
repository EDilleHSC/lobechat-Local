const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/design-approval.html`;

test.describe('Accessibility: Demo modal & toast', () => {
  test('modal has proper ARIA and focus management', async ({ page }) => {
    await page.goto(BASE);
    // Open modal
    await page.click('#btnDemoToggle');

    // Modal role and aria attributes
    const modal = await page.$('#demoModal');
    expect(await modal.getAttribute('role')).toBe('dialog');
    expect(await modal.getAttribute('aria-modal')).toBe('true');
    expect(await modal.getAttribute('aria-hidden')).toBe('false');

    // Focus should be on the title inside the modal
    const active = await page.evaluate(() => document.activeElement.id);
    expect(active).toBe('demoTitle');

    // Try tabbing forward/back within modal to ensure focus stays inside
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const afterTab = await page.evaluate(() => document.activeElement.closest('#demoModal') !== null);
    expect(afterTab).toBe(true);

    // Close modal and ensure aria-hidden toggles and focus is restored
    await page.click('#demoModal button:nth-of-type(2)'); // Close button
    expect(await modal.getAttribute('aria-hidden')).toBe('true');
    // Focus restored to toggle button
    const restored = await page.evaluate(() => document.activeElement.id === 'btnDemoToggle');
    expect(restored).toBe(true);
  });

  test('toast uses live region for announcements', async ({ page }) => {
    await page.goto(BASE);
    await page.click('#btnDemoToggle');
    await page.fill('#signatureName', 'A11y User');
    await page.click('#btnApprove');

    const toast = await page.waitForSelector('#toast', { state: 'visible' });
    expect(await toast.getAttribute('role')).toBe('status');
    expect(await toast.getAttribute('aria-live')).toBe('polite');
    expect(await toast.textContent()).toContain('Demo: Approval submitted');
  });
});