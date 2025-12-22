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
    test.setTimeout(60000);
    // Ensure the file is present
    await expect(page.locator('.file-card h3:has-text("Client_Notes_Intro.docx")')).toBeVisible({ timeout: 15000 });
    // Click the top Track action (acts on first file)
    await page.locator('button.btn-track').first().click();
    // Wait for notes area to appear for the file and Confirm the decision while awaiting the approval POST
    await page.locator('[id="notes-Client_Notes_Intro.docx"]').waitFor({ state: 'visible', timeout: 5000 });
    await Promise.all([
      page.waitForResponse('**/approval'),
      page.locator('[id="notes-Client_Notes_Intro.docx"] button[data-decision="Confirm"]').click()
    ]);
    expect(lastReq).not.toBeNull();
    const post = JSON.parse(lastReq.postData());
    // Confirm a decision payload was posted for the expected file
    expect(post.file).toBe('Client_Notes_Intro.docx');
    expect(['Confirm','Track']).toContain(post.decision);

    // Simulate audit refresh returning a new row (client should re-render)
    await page.route('**/approvals/audit', route => {
      route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify([
        { file: 'Client_Notes_Intro.docx', decision: 'Track', by: 'MailRoom', notes: 'OK', timestamp: new Date().toISOString() }
      ])});
    });

    // Force refresh by reloading page (simulate audit refresh)
    await page.reload();
    // Wait for the file list to reflect the updated decision from the audit route
    await expect(page.locator('.file-card:has-text("Client_Notes_Intro.docx") .meta-item:has-text("Routed to:") .meta-value')).toHaveText('Track', { timeout: 10000 });
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
    test.setTimeout(60000);
    await page.evaluate(() => { window.__TEST_PROMPT = 'test note'; });
    // Ensure the dummy file is present
    await expect(page.locator('.file-card h3:has-text("X.docx")')).toBeVisible({ timeout: 15000 });
    // Click top Track action to open notes for the first file
    await page.locator('button.btn-track').first().click();
    // Wait for notes area for X.docx and click Confirm while awaiting dialog
    await page.locator('[id="notes-X.docx"]').waitFor({ state: 'visible', timeout: 5000 });
    const [alertDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.locator('[id="notes-X.docx"] button[data-decision="Confirm"]').click()
    ]);
    expect(alertDialog.message()).toContain('Decision failed');
    await alertDialog.dismiss();
    await page.evaluate(() => { delete window.__TEST_PROMPT; });
  });
});