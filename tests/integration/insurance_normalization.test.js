const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('insurance normalization and override', () => {
  const inbox = path.join(__dirname, '..', '..', 'NAVI', 'inbox');
  const packages = path.join(__dirname, '..', '..', 'NAVI', 'packages');
  const filename = 'Final_Insurance_Test.pdf';
  const filePath = path.join(inbox, filename);

  beforeAll(() => {
    if (!fs.existsSync(inbox)) fs.mkdirSync(inbox, { recursive: true });
    fs.writeFileSync(filePath, "Progressive Insurance Policy #12345 Premium Due", { encoding: 'utf8' });
    execSync('curl -sS -X POST http://127.0.0.1:8005/process -H "Content-Type: application/json" -d "{}"');
  });

  test('sidecar should be auto routed to CFO with insurance_override', (done) => {
    setTimeout(() => {
      const files = (function walk(dir) {
        if (!fs.existsSync(dir)) return [];
        let out = [];
        for (const f of fs.readdirSync(dir)) {
          const fp = path.join(dir, f);
          if (fs.statSync(fp).isDirectory()) out = out.concat(walk(fp));
          else if (f.includes(filename)) out.push(fp);
        }
        return out;
      })(packages);

      expect(files.length).toBeGreaterThan(0);
      const sc = JSON.parse(fs.readFileSync(files[0], 'utf8'));
      expect(sc.routing.destination).toBe('CFO');
      expect(sc.ai_classification.department).toBe('CFO');
      expect(sc.ai_classification.normalization).toBe('insurance_override');
      expect(sc.routing.reasons).toContain('insurance_override');
      done();
    }, 4000);
  }, 15000);

});
