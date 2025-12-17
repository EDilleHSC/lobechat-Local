const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..');
const INBOX = path.join(ROOT, 'NAVI', 'inbox');
const AGENT_INBOX = path.join(ROOT, 'NAVI', 'agents', 'agent1', 'inbox');
const INDEX_HTML = path.join(ROOT, 'NAVI', 'presenter', 'index.html');
const PROCESS_URL = 'http://localhost:8005/process';

function writeInboxFile(name, content) {
  if (!fs.existsSync(INBOX)) fs.mkdirSync(INBOX, { recursive: true });
  fs.writeFileSync(path.join(INBOX, name), content, 'utf8');
}

function rmAgentFile(name) {
  const p = path.join(AGENT_INBOX, name);
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
}

function postProcess() {
  return new Promise((resolve, reject) => {
    const req = http.request(PROCESS_URL, { method: 'POST' }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid /process response: ' + body));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const fname = 'smoke_mail.txt';
  const content = 'smoke test ' + Date.now();

  // ensure agent inbox clean
  if (!fs.existsSync(AGENT_INBOX)) fs.mkdirSync(AGENT_INBOX, { recursive: true });
  rmAgentFile(fname);

  // write file to inbox
  writeInboxFile(fname, content);

  // run process
  console.log('Triggering /process...');
  const res = await postProcess();
  console.log('Process response:', res);

  // wait briefly
  await new Promise(r => setTimeout(r, 1000));

  // check agent inbox
  const routedPath = path.join(AGENT_INBOX, fname);
  if (!fs.existsSync(routedPath)) {
    console.error('FAIL: Routed file not found:', routedPath);
    process.exit(2);
  }

  // check presenter shows routed_to (TRUST_HEADER)
  const index = fs.readFileSync(INDEX_HTML, 'utf8');
  if (index.indexOf('mailroom_routed_to: agent1') === -1) {
    console.error('FAIL: presenter TRUST_HEADER does not include mailroom_routed_to: agent1');
    console.error(index.split('\n').slice(0,40).join('\n'));
    process.exit(3);
  }

  console.log('PASS: mailroom routed file and presenter updated');
  process.exit(0);
})();
