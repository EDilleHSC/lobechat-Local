const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const url = 'http://localhost:8005/presenter/mail-room.html';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.container', { timeout: 5000 });
  const filePath = path.resolve(__dirname, '..', 'tmp_mailroom.png');
  const el = await page.$('.container');
  if (el) {
    await el.screenshot({ path: filePath });
    console.log('screenshot:', filePath);
  } else {
    await page.screenshot({ path: filePath, fullPage: true });
    console.log('screenshot (full):', filePath);
  }
  await browser.close();
})();