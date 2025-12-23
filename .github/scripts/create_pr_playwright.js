const https = require('https');
const token = process.env.GH_TOKEN;
if (!token) { console.error('NO_TOKEN'); process.exit(2); }
const body = JSON.stringify({
  title: 'ci(playwright): add E2E workflow and docs',
  head: 'feat/playwright-ci',
  base: 'main',
  body: `This PR adds:\n\n- Playwright webServer config to auto-start a static server for tests\n- GitHub Actions workflow: .github/workflows/playwright.yml\n- README docs for running and rebaselining Playwright visual tests\n\nChecklist:\n- Playwright webServer added\n- GitHub Actions workflow added\n- Local E2E verification done\n\nPlease review and assign a reviewer: @EDilleHSC`
});

const opts = {
  method: 'POST',
  hostname: 'api.github.com',
  path: '/repos/EDilleHSC/lobechat-Local/pulls',
  headers: {
    'User-Agent': 'node',
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(opts, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    try {
      const json = data ? JSON.parse(data) : null;
      if (json && json.html_url) console.log(json.html_url);
      else console.log('RESPONSE', data);
    } catch (e) { console.error('PARSE_ERROR', e.message); console.log('RAW', data); }
  });
});
req.on('error', e => { console.error('REQ_ERR', e); process.exit(1); });
req.write(body);
req.end();
