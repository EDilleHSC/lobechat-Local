const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/design-approval.html`;

test.describe('NAVI Approval flow (e2e)', () => {
  test('fill form and show success (stubbed POST)', async ({ page }) => {
    page.on('console', m => console.log('PAGE LOG:', m.text()));
    page.on('request', r => console.log('REQ', r.method(), r.url()));
    page.on('response', r => console.log('RESP', r.status(), r.url()));
    page.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await page.goto(BASE);
    // Ensure the client JS initialized and bound the submit handler
    await page.waitForFunction(() => window.__handleSubmitBound === true, { timeout: 3000 });

    // Basic page smoke checks - ensure snapshot display exists
    await expect(page.locator('[data-testid="snapshot"]')).toBeVisible();

    // Fill in token and approval fields using data-testid selectors
    await page.fill('[data-testid="token-input"]', 'test-token');
    await page.fill('[data-testid="approvedBy-input"]', 'E2E User');
    await page.fill('[data-testid="role-input"]', 'QA');
    await page.check('[data-testid="check-layout"]');
    await page.check('[data-testid="check-accessibility"]');
    await page.fill('[data-testid="notes-input"]', 'E2E test notes');

    // Stub the POST /approval so the test is non-destructive and deterministic
    await page.route('**/approval', route => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ file: 'NAVI/approvals/2025-12-19/test.approval.json' })
    }));

    // Ensure inputs were filled (debug)
    const tokenVal = await page.inputValue('[data-testid="token-input"]');
    console.log('TOKEN VAL:', tokenVal);
    const nameVal = await page.inputValue('[data-testid="approvedBy-input"]');
    console.log('NAME VAL:', nameVal);

    // As a debug step: a direct fetch from the page context (should be intercepted by route)
    const evalFetch = await page.evaluate(() => {
      return fetch('/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ debug: true }) })
        .then(r => r.status)
        .catch(e => 'ERR:' + (e && e.message));
    });
    console.log('EVAL FETCH STATUS:', evalFetch);

    // Submit approval (via UI)
    await page.click('[data-testid="submit-approval"]');

    // Expect a success result to contain persisted file reference (wait for content)
    const out = page.locator('[data-testid="result"]');
    await page.waitForFunction(selector => document.querySelector(selector) && document.querySelector(selector).textContent.length>0, '[data-testid="result"]');
    await expect(out).toContainText('Approval persisted', { timeout: 5000 });
  });
});