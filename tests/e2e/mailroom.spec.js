const { test, expect } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8005;
const BASE = `http://localhost:${PORT}/presenter/mail-room.html`;

test.describe('Mail Room UI', () => {
  test('shows entries from audit and posts decisions', async ({ page }) => {
    await page.route('**/approvals/audit', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { file: 'Client_Notes_Intro.docx', decision: 'Track', by: 'Alice', notes: '', timestamp: new Date().toISOString() }
      ])});
    });

    // stub approval POST
    let lastReq = null;
    await page.route('**/approval', route => {
      const req = route.request();
      lastReq = req;
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok:true }) });
    });

    await page.goto(BASE);
    await expect(page.locator('text=Client_Notes_Intro.docx')).toBeVisible();

    // Click Track and ensure request sent
    await page.click('button.action-btn[data-decision="Track"]');
    // Wait for the fetch to occur
    await page.waitForResponse('**/approval');
    expect(lastReq).not.toBeNull();
    const post = JSON.parse(lastReq.postData());
    expect(post.status).toBe('Track');

    // Simulate audit refresh returning a new row (client should re-render)
    await page.route('**/approvals/audit', route => {
      route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify([
        { file: 'Client_Notes_Intro.docx', decision: 'Track', by: 'MailRoom', notes: 'OK', timestamp: new Date().toISOString() }
      ])});
    });

    // Force refresh by calling the page's refresh() (exposed via global in script is not available)
    // Instead wait for next poll cycle (setInterval 5s) - but to make test robust, just reload page
    await page.reload();
    await expect(page.locator('text=MailRoom')).toBeVisible();
  });

  test('shows error when POST fails', async ({ page }) => {
    await page.route('**/approvals/audit', route => route.fulfill({ status:200, contentType:'application/json', body: '[]' }));
    await page.route('**/approval', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid approval token' }) }));

    await page.goto(BASE);
    await page.fill('#token', 'BAD');
    // Add a dummy file row by setting audit route to return one
    await page.route('**/approvals/audit', route => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify([{ file:'X.docx', decision:'Track', by:'A', notes:'', timestamp: new Date().toISOString() }]) }));
    await page.reload();

    // Click Track: set a test prompt (avoid browser prompt) and expect an alert with error
    await page.evaluate(() => { window.__TEST_PROMPT = 'test note'; });
    await page.click('button.action-btn[data-decision="Track"]');
    const alertDialog = await page.waitForEvent('dialog');
    expect(alertDialog.message()).toContain('Approval failed');
    await alertDialog.dismiss();
    await page.evaluate(() => { delete window.__TEST_PROMPT; });
  });
});