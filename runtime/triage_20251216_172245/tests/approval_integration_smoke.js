const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..');
const SERVER = path.join(ROOT, 'runtime', 'triage_20251216_172245', 'mcp_server.js');
const APPROVAL_DIR = path.join(ROOT, 'NAVI', 'approvals');

(async function main(){
  try {
    console.log('Approval integration smoke starting...');
    const PORT = await (async ()=>{
      const s = require('net').createServer();
      await new Promise((r,rej)=> s.listen(0, r));
      const p = s.address().port;
      await new Promise(r=> s.close(r));
      return p;
    })();

    // Cleanup any prior artifacts
    try { fs.rmSync(APPROVAL_DIR, { recursive: true, force: true }); } catch(e){}

    const child = spawn(process.execPath, [SERVER], { env: Object.assign({}, process.env, { PORT: String(PORT), MCP_APPROVAL_TOKEN: 'TEST_APPROVAL_TOKEN', ENABLE_TEST_ADMIN: '1', MCP_SHUTDOWN_TOKEN: 'TEST_SHUTDOWN' }), stdio: ['ignore','pipe','pipe'] });
    child.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
    child.stderr.on('data', d => process.stderr.write(`[server:err] ${d}`));

    // Wait for health
    await (async function waitHealth(){
      for (let i=0;i<50;i++){
        try{
          const r = await new Promise((res,rej)=>{
            const req = http.request({ hostname: 'localhost', port: PORT, path: '/health', method: 'GET', timeout: 2000 }, (resp)=>{ let buf=''; resp.on('data',c=>buf+=c); resp.on('end', ()=>res({status:resp.statusCode, body: buf})); }); req.on('error', rej); req.end();
          });
          if (r && r.status === 200) return;
        }catch(e){}
        await new Promise(r=>setTimeout(r,200));
      }
      throw new Error('health endpoint never available');
    })();

    // POST approval
    const payload = {
      approvedBy: 'Test Operator',
      date: new Date().toISOString(),
      role: 'QA',
      notes: 'Smoke approval',
      checklist: { layout: true, accessibility: true, bugFixed: true, production: true },
      status: 'approved'
    };

    const res = await new Promise((resolve,reject)=>{
      const req = http.request({ hostname: 'localhost', port: PORT, path: '/approval', method: 'POST', headers: { 'content-type': 'application/json', 'x-mcp-approval-token': 'TEST_APPROVAL_TOKEN' }, timeout: 5000 }, (resp)=>{ let buf=''; resp.on('data', c=>buf+=c); resp.on('end', ()=>resolve({ status: resp.statusCode, body: buf })); }); req.on('error', reject); req.write(JSON.stringify(payload)); req.end();
    });

    if (res.status !== 201) throw new Error('Approval endpoint responded: ' + res.status + ' ' + res.body);
    const j = JSON.parse(res.body);
    if (!j.file) throw new Error('No file returned by approval endpoint');
    if (!fs.existsSync(j.file)) throw new Error('Approval file not found: ' + j.file);

    // Check audit
    const auditPath = path.join(APPROVAL_DIR, 'audit.log');
    if (!fs.existsSync(auditPath)) throw new Error('Audit log missing');
    const audit = fs.readFileSync(auditPath, 'utf8');
    if (audit.indexOf('approved') === -1) throw new Error('Audit log does not contain approval entry');

    console.log('Approval integration smoke PASSED');

    // Shutdown
    await new Promise((resolve, reject) => {
      const req = http.request({ method: 'POST', hostname: 'localhost', port: PORT, path: '/__mcp_shutdown?token=TEST_SHUTDOWN', timeout: 5000 }, (resp)=>{ resp.on('data',()=>{}); resp.on('end', resolve); }); req.on('error', reject); req.end();
    });

    process.exit(0);
  } catch (err) {
    console.error('Approval integration smoke FAILED:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();