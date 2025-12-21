import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8005/presenter/';

test.describe('NAVI Presenter smoke tests (read-only, non-destructive)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message, err.stack));
    // Inject handlers before any page script runs
    await page.addInitScript(() => {
      window.onerror = function(msg, src, lineno, colno, err) {
        console.log('WIN ERROR:', msg, src, lineno, colno, err && err.stack);
      };
      window.addEventListener('error', e => console.log('WIN ERR EVENT:', e.error && e.error.stack ? e.error.stack : e.message));

      try {
        const _fetch = window.fetch;
        window.fetch = function(...args) {
          return _fetch.apply(this, args).then(res => {
            if (!res.ok) console.log('FETCH FAILED', args[0], res.status, res.url);
            return res;
          }).catch(err => {
            console.log('FETCH ERROR', args[0], err && err.message);
            throw err;
          });
        };
      } catch (e) {
        console.log('Failed to wrap fetch', e && e.message);
      }
    });
    await page.goto(BASE);
  });

  test('data-ready gating and snapshot provenance', async ({ page }) => {
    // Wait for snapshot header to contain 'Snapshot:' which indicates presenter.json loaded
    await expect(page.locator('#snapshotHeader')).toHaveText(/Snapshot:/, { timeout: 15000 });

    // Snapshot provenance should be populated (not be the placeholder)
    const prov = (await page.locator('#snapshotProvenance').innerText()).trim();
    expect(prov).not.toBe('Snapshot: —');
  });

  test('low-confidence blocking and approve sublabel', async ({ page }) => {
    // Iterate until a low-confidence item is found (if present)
    let foundLow = false;
    for (let i = 0; i < 8; i++) {
      const confText = (await page.locator('#aiConfBadge').innerText()).trim();
      const conf = parseInt(confText.replace('%', ''), 10) || 0;
      if (conf < 70) {
        foundLow = true;
        await expect(page.locator('#approveBtn')).toBeDisabled();
        await expect(page.locator('#approveSublabel')).toHaveText(/Low confidence/);
        break;
      }
      // advance
      await page.click('#nextBtn');
      await page.waitForTimeout(200);
    }

    if (!foundLow) test.skip('No low-confidence item found to validate blocking');
  });

  test('override requires reason or notes and advances when provided', async ({ page }) => {
    // Show override options
    await page.click('.secondary-toggle');
    // Try clicking an override button without selecting reason or notes
    await page.click('.override-btn:has-text("Legal")');

    await expect(page.locator('#toast .toast-text')).toHaveText(/Please select a reason/);

    // Provide a reason and try again
    await page.selectOption('#overrideReason', 'confidential');
    await page.click('.override-btn:has-text("Legal")');

    await expect(page.locator('#toast .toast-text')).toHaveText(/Override → LEGAL/);

    // Wait for auto-advance to next item
    await page.waitForTimeout(700);

    const num = parseInt((await page.locator('#currentNum').innerText()).trim(), 10);
    expect(num).toBeGreaterThan(1);
  });

  test('submitAll invariant blocks incomplete and allows success when complete', async ({ page }) => {
    // Navigate to finish: click Skip until button says Finish
    for (let i = 0; i < 20; i++) {
      const text = (await page.locator('#nextBtn').innerText()).trim();
      if (text.includes('Finish')) break;
      await page.click('#nextBtn');
      await page.waitForTimeout(120);
    }

    // Click Finish to show completion
    await page.click('#nextBtn');
    await page.waitForSelector('#completionScreen', { state: 'visible' });

    // Try to submit when some decisions missing - expect blocking toast
    await page.click('.completion-btn');
    await expect(page.locator('#toast .toast-text')).toHaveText(/Some review-required items have no decision./);

    // Mark all items as overrides programmatically to satisfy invariant
    await page.evaluate(() => {
      for (let i = 0; i < items.length; i++) {
        decisions[i] = decisions[i] || {};
        decisions[i].decision = 'override';
        decisions[i].route = 'LEGAL';
        decisions[i].notes = 'Automated test override';
        decisions[i].timestamp = new Date().toISOString();
      }
      showCompletion();
    });

    // Intercept and stub server endpoint so we don't modify state
    await page.route('**/clear_exceptions', route => route.fulfill({ status: 200, body: 'OK' }));

    // Submit and expect success toast
    await page.click('.completion-btn');
    await expect(page.locator('#toast .toast-text')).toHaveText(/All decisions submitted!/);
  });
});
