const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const wd = path.resolve(__dirname, '..');
const out = path.join(wd, 'server_out.test.log');
const err = path.join(wd, 'server_err.test.log');
const override = process.argv[2] || 'D:/temp_navi_override_test';

if (!fs.existsSync(override)) fs.mkdirSync(override, { recursive: true });

if (fs.existsSync(out)) fs.unlinkSync(out);
if (fs.existsSync(err)) fs.unlinkSync(err);

const child = spawn('node', ['mcp_server.js'], { cwd: wd, env: Object.assign({}, process.env, { NAVI_ROOT: override }) , stdio: ['ignore', 'pipe', 'pipe'] });

child.stdout.pipe(fs.createWriteStream(out, { flags: 'a' }));
child.stderr.pipe(fs.createWriteStream(err, { flags: 'a' }));

let done = false;
setTimeout(() => {
  const data = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (data.includes(`NAVI_ROOT=${override}`)) {
    console.log('TEST PASS: NAVI_ROOT override honored');
    done = true;
  } else {
    console.error('TEST FAIL: NAVI_ROOT not found in logs');
    console.error('---- server_out ----');
    console.error(data);
  }
  // Kill child
  try { process.kill(child.pid); } catch (e) {}
  process.exit(done ? 0 : 2);
}, 3000);
