const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/design-approval.html`;

test.describe('Manual Approval UI (e2e)', () => {
  test('shows disabled submit while request in-flight and announces success', async ({ page }) => {
    await page.goto(BASE);
    // Ensure the client JS initialized and bound the submit handler
    await page.waitForFunction(() => window.__handleSubmitBound === true, { timeout: 3000 });

    // Attach console logs for debugging
    page.on('console', m => console.log('PAGE LOG:', m.text()));

    // Capture the request body to assert payload contents
    let lastRequest = null;
    await page.route('**/approval', async route => {
      const req = route.request();
      try { lastRequest = JSON.parse(req.postData() || '{}'); } catch(e) { lastRequest = null; }
      await new Promise(r => setTimeout(r, 300));
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ file: 'NAVI/approvals/e2e.json' }) });
    });

    // Quick sanity test: a direct fetch should be intercepted by the route
    const quick = await page.evaluate(() => fetch('/approval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ check: true }) }).then(r => r.status).catch(e => 'ERR:' + e.message));
    console.log('QUICK FETCH STATUS:', quick);

    // Install error collectors to surface client-side issues
    await page.evaluate(() => {
      window.__errors = [];
      window.addEventListener('error', e => window.__errors.push('ERR:' + (e && e.message)));
      window.addEventListener('unhandledrejection', e => window.__errors.push('REJ:' + (e && e.reason && e.reason.message ? e.reason.message : JSON.stringify(e))));
    });

    await page.fill('[data-testid="token-input"]', 'test-token');
    await page.fill('[data-testid="approvedBy-input"]', 'E2E Tester');
    await page.fill('[data-testid="file-input"]', 'Client_Notes_Intro.docx');
    await page.click('[data-testid="check-layout"]');
    await page.fill('[data-testid="notes-input"]', 'E2E note go');
    // Use $eval to ensure click triggers page handlers in tricky layouts
    await page.$eval('[data-testid="action-track"]', el => el.click());

    // Sanity checks: ensure inputs are present before submit
    expect(await page.inputValue('[data-testid="token-input"]')).toBe('test-token');
    expect(await page.inputValue('[data-testid="file-input"]')).toBe('Client_Notes_Intro.docx');
    // Click the visible submit button like a real user and wait for the actual network request to appear
    const [request] = await Promise.all([
      page.waitForRequest('**/approval', { timeout: 5000 }),
      page.click('button[type="submit"]'),
    ]);

    // Ensure the button is marked busy quickly
    await page.waitForFunction(() => document.querySelector('[data-testid="submit-approval"]').getAttribute('aria-busy') === 'true');

    // Wait for success announcement
    const out = page.locator('[data-testid="result"]');
    await out.waitFor({ state: 'visible', timeout: 5000 });
    await expect(out).toContainText('Approval persisted');

    // Verify payload sent includes notes, file, snapshot, and status
    const reqBody = JSON.parse(request.postData() || '{}');
    expect(reqBody.notes).toBe('E2E note go');
    expect(reqBody.file).toBe('Client_Notes_Intro.docx');
    expect(reqBody.status).toBe('Track');

    // Ensure no client-side errors occurred
    const clientErrors = await page.evaluate(() => window.__errors || []);
    expect(clientErrors.length).toBe(0);
  });

  test('shows error message when POST fails', async ({ page }) => {
    await page.route('**/approval', route => route.fulfill({ status: 500, contentType: 'text/plain', body: 'oops' }));
    await page.goto(BASE);
    // Ensure the client JS initialized and bound the submit handler
    await page.waitForFunction(() => window.__handleSubmitBound === true, { timeout: 3000 });

    await page.fill('[data-testid="token-input"]', 'test-token');
    await page.fill('[data-testid="approvedBy-input"]', 'E2E Tester');
    await page.click('[data-testid="submit-approval"]');

    const err = page.locator('[data-testid="error"]');
    await err.waitFor({ state: 'visible', timeout: 5000 });
    await expect(err).toContainText('Approval failed');
  });
});