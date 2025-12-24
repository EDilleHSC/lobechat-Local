const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Demo Mode unit tests', () => {
  // Skip demo tests under NAVI v2 CI alignment (approval flows are audit-only)
  if (process.env.NAVI_V2 === '1') { console.log('Skipping demo tests under NAVI_V2'); return; }
  let dom, window, document;

  beforeEach(async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'presenter', 'design-approval.html'), 'utf8');
    dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost' });
    window = dom.window;
    document = window.document;
    // Wait for scripts to execute
    await new Promise((r) => setTimeout(r, 10));
  });

  afterEach(() => {
    if (dom && dom.window) dom.window.close();
  });

  test('entering demo mode opens modal and sets aria attributes', () => {
    const toggle = document.getElementById('btnDemoToggle');
    expect(toggle).toBeTruthy();
    // trigger
    toggle.click();
    const modal = document.getElementById('demoModal');
    expect(modal.classList.contains('open')).toBe(true);
    expect(modal.getAttribute('aria-hidden')).toBe('false');
  });

  test('completing steps marks checklist items', () => {
    document.getElementById('btnDemoToggle').click();
    // fill name and approve
    document.getElementById('signatureName').value = 'Test User';
    document.getElementById('btnApprove').click();
    const items = document.querySelectorAll('#demoChecklist li.complete');
    // Should mark at least step 1 and 3
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  test('resetDemo clears steps', () => {
    document.getElementById('btnDemoToggle').click();
    document.getElementById('signatureName').value = 'Test User';
    document.getElementById('btnApprove').click();
    document.getElementById('btnDemoToggle').click(); // close
    document.getElementById('btnDemoToggle').click(); // open again
    document.getElementById('demoModal').querySelector('button[onclick="resetDemo()"]').click();
    const items = document.querySelectorAll('#demoChecklist li.complete');
    expect(items.length).toBe(0);
  });
});