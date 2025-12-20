const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const BASE = 'http://localhost:8005/presenter/design-approval.html';

  await page.goto(BASE);
  console.log('Page loaded');

  // Fill form
  await page.fill('[data-testid="token-input"]', 'TEST_APPROVAL');
  await page.fill('[data-testid="approvedBy-input"]', 'Automation Tester');
  await page.fill('[data-testid="file-input"]', 'Client_Notes_Intro.docx');
  await page.check('[data-testid="check-layout"]');
  await page.fill('[data-testid="notes-input"]', 'E2E manual test');
  // select Track
  await page.$eval('#decTrack', el => el.click());

  // Submit and wait for network response
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().endsWith('/approval') && resp.status() === 201, { timeout: 5000 }),
    page.click('[data-testid="submit-approval"]')
  ]).catch(e => { console.error('Submit or waitForResponse failed', e); return [null]; });

  if (response) {
    console.log('Submit response status:', response.status());
    const text = await response.text();
    console.log('Response text:', text);
  } else {
    console.error('No response captured');
  }

  // Check success UI
  const out = page.locator('[data-testid="result"]');
  await out.waitFor({ state: 'visible', timeout: 3000 });
  console.log('Result text:', await out.textContent());

  // Check audit log file
  const auditPath = 'NAVI/approvals/audit.log';
  const audit = fs.readFileSync(auditPath, 'utf8');
  console.log('Audit tail:', audit.split('\n').slice(-5).filter(Boolean).join('\n'));

  // Now test invalid token
  // Clear token and fill bad value
  await page.fill('[data-testid="token-input"]', 'BAD_TOKEN');
  await page.fill('[data-testid="approvedBy-input"]', 'Automation Tester');
  await page.click('[data-testid="submit-approval"]');

  const err = page.locator('[data-testid="error"]');
  await err.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Error text:', await err.textContent());

  await browser.close();
})();
