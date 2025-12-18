const http = require('http');
(async function main(){
  try {
    console.log('approval_invalid_json starting...');
    const PORT = await (async ()=>{ const s = require('net').createServer(); await new Promise(r=> s.listen(0,r)); const p = s.address().port; await new Promise(r=> s.close(r)); return p; })();
    const child = require('child_process').spawn(process.execPath, [require('path').join(__dirname, '..', 'mcp_server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), ENABLE_TEST_ADMIN: '1', MCP_SHUTDOWN_TOKEN: 'TEST_SHUTDOWN', MCP_APPROVAL_TOKEN: 'TEST_APPROVAL' }), stdio: ['ignore','pipe','pipe'] });
    child.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
    child.stderr.on('data', d => process.stderr.write(`[server:err] ${d}`));

    // wait for health
    await (async function(){ for (let i=0;i<40;i++){ try{ const r = await new Promise((res,rej)=>{ const req = http.request({ hostname:'localhost', port: PORT, path:'/health', method:'GET', timeout:2000 }, (resp)=>{ let b=''; resp.on('data',c=>b+=c); resp.on('end', ()=>res({status: resp.statusCode})); }); req.on('error', rej); req.end(); }); if (r && r.status===200) return; }catch(e){} await new Promise(r=>setTimeout(r,200)); } throw new Error('health unavailable'); })();

    // Call /approval with malformed JSON
    const res = await new Promise((resolve,reject)=>{ const req = http.request({ hostname:'localhost', port: PORT, path: '/approval', method: 'POST', headers: { 'content-type':'application/json', 'x-mcp-approval-token': 'TEST_APPROVAL' }, timeout: 3000 }, (resp)=>{ let b=''; resp.on('data', c=> b+=c); resp.on('end', ()=> resolve({ status: resp.statusCode, body: b })); }); req.on('error', reject); req.write('{ bad:'); req.end(); });
    if (res.status !== 400) throw new Error('expected 400 for malformed JSON, got ' + res.status + ' ' + res.body);
    console.log('approval_invalid_json PASSED');

    // shutdown
    await new Promise((resolve,reject)=>{ const req = http.request({ method: 'POST', hostname:'localhost', port: PORT, path: '/__mcp_shutdown?token=TEST_SHUTDOWN' }, res=>{ res.on('data', ()=>{}); res.on('end', resolve); }); req.on('error', reject); req.end(); });
    process.exit(0);
  } catch (err) { console.error('approval_invalid_json FAILED:', err && err.message ? err.message : err); process.exit(2); }
})();