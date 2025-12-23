import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const INBOX = `D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\inbox`;
const PRESENTER_URL = 'http://localhost:8005/presenter/generated/presenter.json';
const PROCESS_URL = 'http://localhost:8005/process';

// UI test: open presenter UI, click Approve, click Submit All, assert toast + presenter reflects decision
test('UI: Approve → Submit All persists decision and clears exception', async ({ page }) => {
  // Ensure server reachable
  try {
    const r = await fetch('http://localhost:8005/health');
    if (!r.ok) test.skip('NAVI /health not responding');
  } catch (e) {
    test.skip('NAVI not running');
  }

  // Use a filename with both business and personal indicators to avoid immediate auto-route
  // (mixed signals typically yield 70-85% confidence -> review-required)
  const fileName = `approve_ui_company_personal_invoice_${Date.now()}.pdf`;
  const filePath = path.join(INBOX, fileName);

  // Backup existing inbox files to a temp holding folder so the test has a single exception
  const holdingRoot = path.join(path.dirname(INBOX), 'HOLDING');
  const backupDir = path.join(holdingRoot, `test_backup_${Date.now()}`);
  try {
    if (!fs.existsSync(INBOX)) fs.mkdirSync(INBOX, { recursive: true });
    if (!fs.existsSync(holdingRoot)) fs.mkdirSync(holdingRoot, { recursive: true });

    const existing = fs.readdirSync(INBOX).filter(f => fs.statSync(path.join(INBOX, f)).isFile());
    if (existing.length > 0) {
      fs.mkdirSync(backupDir, { recursive: true });
      for (const f of existing) {
        try { fs.renameSync(path.join(INBOX, f), path.join(backupDir, f)); } catch(e) { /* best-effort */ }
      }
    }

    fs.writeFileSync(filePath, 'Approval UI test content');

    // Trigger processing
    const res = await fetch(PROCESS_URL, { method: 'POST' });
    expect(res.ok).toBeTruthy();
    const payload = await res.json();
    expect(payload.status).toBe('ok');

    // Wait for presenter to include our file
    async function waitForPresenterIncludes(url: string, filename: string, retries = 60, delay = 500) {
      for (let i = 0; i < retries; i++) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            const data = await r.json();
            if ((data.items || []).some((it: any) => it.filename === filename)) return data;
            // If the file was auto-routed it may not appear in exceptions; return data so caller can detect
            if ((data.items || []).every((it: any) => it.filename !== filename && it.filename)) return data;
          }
        } catch (e) { }
        await new Promise(r => setTimeout(r, delay));
      }
      throw new Error('Presenter did not include file in time');
    }

    const presenter = await waitForPresenterIncludes(PRESENTER_URL, fileName);

    // Open the UI
    await page.goto('http://localhost:8005/presenter/index.html');

    // Wait for UI to load and show our file (navigate with Next if needed)
    await page.waitForSelector('#fileName');

    const maxNavAttempts = 10;
    let found = false;
    for (let i = 0; i < maxNavAttempts; i++) {
      const current = await page.textContent('#fileName');
      if (current && current.trim() === fileName) { found = true; break; }
      // Click next to cycle
      const nextBtn = await page.$('#nextBtn');
      if (nextBtn) await nextBtn.click();
      await page.waitForTimeout(250);
    }
    expect(found).toBeTruthy();

    // Wait for approve button to be enabled (we seed a filename that tends to be high-confidence)
    await page.waitForSelector('#approveBtn:not([disabled])', { timeout: 5000 });
    await page.click('#approveBtn');

    // Because this should be the only review-required item, the UI should reach completion and show the submit button
    await page.waitForSelector('text=Submit All Decisions', { timeout: 10000 });
    await page.click('text=Submit All Decisions');

    // Skip asserting toast text (can be transient); rely on presenter.json change instead
    await page.waitForSelector('#toastText');
    // Small pause to let client-server roundtrip complete
    await page.waitForTimeout(200);

    // Finally confirm presenter.json contains the human_routed_files entry for our file
    async function waitForHumanRouted(url: string, filename: string, retries = 20, delay = 500) {
      for (let i = 0; i < retries; i++) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data.human_routed_files) && data.human_routed_files.some((h: any) => h.filename === filename)) return data;

            // Also accept the item being absent from the review-required list (exceptions cleared)
            const items = data.items || [];
            if (!items.some((it: any) => it.filename === filename)) return data;
          }
        } catch (e) { }
        await new Promise(r => setTimeout(r, delay));
      }
      throw new Error('Presenter did not reflect human routing in time');
    }

    const updated = await waitForHumanRouted(PRESENTER_URL, fileName);
    const matched = (updated.human_routed_files || []).find((h: any) => h.filename === fileName);
    expect(matched).toBeDefined();

  } finally {
    // Cleanup the injected file (move to HOLDING) and restore any backed-up inbox files
    const holding = path.join(path.dirname(INBOX), 'HOLDING');
    if (!fs.existsSync(holding)) fs.mkdirSync(holding, { recursive: true });
    if (fs.existsSync(filePath)) {
      try { fs.renameSync(filePath, path.join(holding, fileName)); } catch(e) { try { fs.unlinkSync(filePath); } catch(e){} }
    }

    // Restore backup if present
    try {
      if (fs.existsSync(backupDir)) {
        const restored = fs.readdirSync(backupDir);
        for (const f of restored) {
          try { fs.renameSync(path.join(backupDir, f), path.join(INBOX, f)); } catch(e) { /* best effort */ }
        }
        // Remove backup dir if empty
        try { fs.rmdirSync(backupDir); } catch(e) { }
      }
    } catch (restoreErr) {
      console.warn('Failed to restore inbox backup:', restoreErr);
    }
  }
});