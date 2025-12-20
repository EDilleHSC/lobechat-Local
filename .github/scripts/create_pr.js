const https = require('https');
const token = process.env.GH_TOKEN;
if(!token){ console.error('NO_TOKEN'); process.exit(2); }
function api(method, path, body){
  return new Promise((res, rej)=>{
    const opts={ method, hostname:'api.github.com', path, headers:{ 'User-Agent':'node', 'Authorization': 'token '+token, 'Accept':'application/vnd.github+json' } };
    const req = https.request(opts, r=>{ let data=''; r.on('data', c=>data+=c); r.on('end', ()=>{ try{ const json = data ? JSON.parse(data) : null; res({status:r.statusCode, body:json}); }catch(e){ rej(e); } }); });
    req.on('error', rej);
    if(body) req.write(JSON.stringify(body));
    req.end();
  });
}
(async ()=>{
  try{
    const get = await api('GET', '/repos/EdilleHSC/lobechat-Local/pulls?head=EdilleHSC:feat/approval-addons&state=open');
    if(get.status===200 && Array.isArray(get.body) && get.body.length>0){ console.log(JSON.stringify({existing:true, url:get.body[0].html_url, number:get.body[0].number})); return; }
    const body={ title: 'Polish: Add Approval logging + tests & gated CI', head:'feat/approval-addons', base:'main', body:'Adds approval logging to NAVI/approvals/audit.log, unit + gated integration tests, Playwright visual + manual e2e tests, and writes errors to NAVI/approvals/audit.err.log when writes fail. Integration tests are gated by MCP_APPROVAL_TOKEN.' };
    const post = await api('POST','/repos/EdilleHSC/lobechat-Local/pulls', body);
    console.log(JSON.stringify({existing:false, status:post.status, url: post.body && post.body.html_url, number: post.body && post.body.number}));
  }catch(e){ console.error('ERROR', e && e.message); process.exit(3); }
})();