const fs = require('fs');
const path = require('path');

describe('CI smoke checks', () => {
  const runStartPath = path.resolve(__dirname, '../../NAVI/approvals/run_start.json');

  test('run_start.json exists and contains valid presenter info', () => {
    expect(fs.existsSync(runStartPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(runStartPath, 'utf8'));

    // Port validation
    expect(data.port).toBeDefined();
    expect(typeof data.port).toBe('number');
    expect(data.port).toBeGreaterThan(1023); // not a privileged port
    expect(data.port).toBeLessThan(65536);

    // Startup metadata
    expect(data.started_at).toBeDefined();
    expect(new Date(data.started_at).getTime()).not.toBeNaN();

    // PID confirms process is real
    expect(data.pid).toBeDefined();
    expect(typeof data.pid).toBe('number');
  });

  test('presenter port matches expected test config', () => {
    const data = JSON.parse(fs.readFileSync(runStartPath, 'utf8'));
    const expectedPort = parseInt(process.env.PRESENTER_PORT || '8006', 10);
    expect(data.port).toBe(expectedPort);
  });
});
