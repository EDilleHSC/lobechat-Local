const express = require('express');
const path = require('path');
const morgan = require('morgan');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8005;
const presenterDir = path.join(__dirname, '..', 'presenter');
const logDir = path.join(__dirname, '..', 'logs');

// Ensure log dir exists
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const accessLogStream = fs.createWriteStream(path.join(logDir, 'presenter.log'), { flags: 'a' });

// Morgan: write both to console and to file
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan(':date[iso] :method :url :status :res[content-length] - :response-time ms'));

// Redirect legacy design-approval to mail-room (catch multiple legacy paths)
app.get(['/presenter/design-approval.html', '/presenter/design-approval', '/design-approval.html', '/design-approval'], (req, res) => {
  console.log('[REDIRECT] design-approval -> mail-room');
  accessLogStream.write(`[REDIRECT] ${new Date().toISOString()} ${req.method} ${req.url}\n`);
  res.redirect(302, '/presenter/mail-room.html');
});

// Serve static files under /presenter (disable directory indexing)
app.use('/presenter', express.static(presenterDir, { index: false }));

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', servedFrom: presenterDir }));

// Endpoint to receive client-side logs
app.post('/presenter/client-log', express.json({ limit: '64kb' }), (req, res) => {
  const entry = req.body || {};
  const msg = `[CLIENT_LOG] ${new Date().toISOString()} ${entry.level || 'log'} ${entry.message || ''} ${entry.meta ? JSON.stringify(entry.meta) : ''}\n`;
  console.log(msg.trim());
  try { fs.appendFileSync(path.join(logDir, 'presenter.log'), msg); } catch (e) {}
  res.status(204).end();
});

// --- Package API endpoints ---
// List packages
app.get('/api/packages', (req, res) => {
  try {
    const packagesDir = path.join(__dirname, '..', 'NAVI', 'packages');
    if (!fs.existsSync(packagesDir)) return res.json([]);
    const pkgs = fs.readdirSync(packagesDir).filter(n => fs.statSync(path.join(packagesDir, n)).isDirectory()).map(name => {
      const p = path.join(packagesDir, name);
      const stat = fs.statSync(p);
      // count files (exclude manifest/README)
      const files = fs.readdirSync(p).filter(f => !f.toLowerCase().endsWith('.md') && !f.toLowerCase().endsWith('.csv'));
      return { name, createdAt: stat.mtime.toISOString(), fileCount: files.length };
    }).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    return res.json(pkgs);
  } catch (err) {
    console.error('[API] /api/packages error', err);
    return res.status(500).json({ error: 'failed to list packages' });
  }
});

// List files in a package
app.get('/api/packages/:pkg/files', (req, res) => {
  try {
    const packagesDir = path.join(__dirname, '..', 'NAVI', 'packages');
    const pkgDir = path.join(packagesDir, req.params.pkg);
    if (!fs.existsSync(pkgDir)) return res.status(404).json({ error: 'package not found' });
    const files = fs.readdirSync(pkgDir).filter(n => !n.toLowerCase().endsWith('.md') && !n.toLowerCase().endsWith('.csv'));
    const out = files.filter(n => !n.endsWith('.navi.json') && !n.endsWith('.meta.json')).map(filename => {
      const naviPath = path.join(pkgDir, filename + '.navi.json');
      let navi = null;
      try { if (fs.existsSync(naviPath)) navi = JSON.parse(fs.readFileSync(naviPath, 'utf8')); } catch(e) { /* ignore */ }
      return {
        filename,
        route: (navi && navi.route) || 'unknown',
        applied_at: (navi && navi.routing && navi.routing.applied_at) || (navi && navi.generated_at) || null,
        snippet: (navi && navi.extracted_text_snippet) ? (navi.extracted_text_snippet.slice(0, 200)) : null
      };
    });
    return res.json(out);
  } catch (err) {
    console.error('[API] /api/packages/:pkg/files error', err);
    return res.status(500).json({ error: 'failed to list package files' });
  }
});

// Return full sidecar for a file
app.get('/api/packages/:pkg/files/:filename', (req, res) => {
  try {
    const packagesDir = path.join(__dirname, '..', 'NAVI', 'packages');
    const pkgDir = path.join(packagesDir, req.params.pkg);
    const naviPath = path.join(pkgDir, req.params.filename + '.navi.json');
    const metaPath = path.join(pkgDir, req.params.filename + '.meta.json');
    const out = {};
    if (fs.existsSync(naviPath)) out.navi = JSON.parse(fs.readFileSync(naviPath, 'utf8'));
    if (fs.existsSync(metaPath)) out.meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return res.json(out);
  } catch (err) {
    console.error('[API] /api/packages/:pkg/files/:filename error', err);
    return res.status(500).json({ error: 'failed to read sidecars' });
  }
});

// Package download (zip on demand)
app.get('/api/packages/:pkg/download', (req, res) => {
  try {
    const packagesDir = path.join(__dirname, '..', 'NAVI', 'packages');
    const pkgDir = path.join(packagesDir, req.params.pkg);
    if (!fs.existsSync(pkgDir)) return res.status(404).json({ error: 'package not found' });
    const archiver = require('archiver');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.pkg}.zip"`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => { console.error('[API] zip error', err); try { res.status(500).end(); } catch (e) {} });
    archive.pipe(res);
    archive.directory(pkgDir, false);
    archive.finalize();
  } catch (err) {
    console.error('[API] /api/packages/:pkg/download error', err);
    return res.status(500).json({ error: 'failed to create package zip' });
  }
});

// Catch-all redirect for root to presenter index
app.get('/', (req, res) => res.redirect(302, '/presenter/mail-room.html'));

// Crash / error handlers: capture uncaught errors to the log file
process.on('uncaughtException', (err) => {
  const msg = `[UNCAUGHT_EXCEPTION] ${new Date().toISOString()} ${err && err.stack ? err.stack : String(err)}\n`;
  console.error(msg);
  try { fs.appendFileSync(path.join(logDir, 'presenter.log'), msg); } catch (e) {}
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const msg = `[UNHANDLED_REJECTION] ${new Date().toISOString()} ${reason}\n`;
  console.error(msg);
  try { fs.appendFileSync(path.join(logDir, 'presenter.log'), msg); } catch (e) {}
});

const server = app.listen(port, '0.0.0.0', () => {
  const msg = `Presenter server listening on http://0.0.0.0:${port}/presenter/ at ${new Date().toISOString()}\n`;
  console.log(msg);
  try { accessLogStream.write(msg); } catch (e) {}
});

// Graceful shutdown
function shutdown() {
  console.log('[SHUTDOWN] stopping presenter server');
  try { accessLogStream.end(); } catch (e) {}
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Export app and server for tests
module.exports = app;
module.exports.__testServer = server;
