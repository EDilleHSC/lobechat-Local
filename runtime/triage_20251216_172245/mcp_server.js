const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const approvalSchema = require('./schemas/approval.schema.json');
const validateApproval = ajv.compile(approvalSchema);

// Explicit Python runtime for predictable execution
const PYTHON = 'D:\\02_SOFTWARE\\Python312\\python.exe';
// Beta-0 trust mode: when true, regenerate presenter from snapshot and skip routing/mailroom
// For Beta-1 we default to OFF so mailroom routing executes by default; set env BETA0_TRUST_MODE=1 to keep Beta-0 behavior
const BETA0_TRUST_MODE = (process.env.BETA0_TRUST_MODE || '0') === '1'; // default OFF for Beta-1 workflow

// Configuration
const INBOX_DIR = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\inbox";
const SNAPSHOT_DIR = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\snapshots\\inbox";
// Approvals directory for persistent approval objects and audit log
const APPROVAL_DIR = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\approvals";
// mcp_server.js lives at: VBoarder/runtime/triage_xxx/mcp_server.js
// so project root is two levels up from __dirname
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const NAVI_DIR = path.join(PROJECT_ROOT, 'NAVI');
const PRESENTER_DIR = path.join(NAVI_DIR, 'presenter');
const PRESENTER_GENERATED_DIR = path.join(PRESENTER_DIR, 'generated');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
};

// Server port can be overridden with the PORT env var for testing/CI
const PORT = Number(process.env.PORT) || 8005;

// Track last activity for health
let lastSnapshotTime = null;
let lastPresenterTime = null;

// Log paths for verification
console.log(`[PATHS] __dirname=${__dirname}`);
console.log(`[PATHS] PROJECT_ROOT=${PROJECT_ROOT}`);
console.log(`[PATHS] NAVI_DIR=${NAVI_DIR}`);
console.log(`[PATHS] INBOX_DIR=${INBOX_DIR}`);
console.log(`[PATHS] SNAPSHOT_DIR=${SNAPSHOT_DIR}`);
console.log(`[PATHS] APPROVAL_DIR=${APPROVAL_DIR}`);
console.log(`[PATHS] PRESENTER_DIR=${PRESENTER_DIR}`);

// Utility functions
function normalizePath(p) {
  return path.normalize(p).toLowerCase();
}

function isPathAllowed(normalizedPath) {
    const allowedPaths = [
        'd:\\05_agents',
        'd:\\05_agents-ai',
        'd:\\01_system',
        'd:\\02_software\\01_ai_models'
    ];
    return allowedPaths.some(allowedPath =>
        normalizedPath.startsWith(allowedPath)
    );
}

function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// PID-file path and helper exposed at module scope so request handlers and signal handlers can access it
const pidFile = path.join(__dirname, 'mcp_server.pid');
function removePidFile() {
    try {
        if (fs.existsSync(pidFile)) {
            console.log(`[MCP] removePidFile: attempting to unlink ${pidFile}`);
            fs.unlinkSync(pidFile);
            console.log('[MCP] removePidFile: success');
        } else {
            console.log('[MCP] removePidFile: pid file not present');
        }
    } catch (e) {
        console.error('[MCP] removePidFile: failed to remove PID file', e);
        // best-effort cleanup; do not rethrow to avoid disrupting shutdown
    }
}

function takeSnapshot() {
    try {
        // Create snapshot of inbox
        const inboxPath = INBOX_DIR;
        const snapshotDir = SNAPSHOT_DIR;

        // Ensure snapshot directory exists
        if (!fs.existsSync(snapshotDir)) {
            fs.mkdirSync(snapshotDir, { recursive: true });
        }

        // Get files in inbox
        const files = fs.readdirSync(inboxPath).filter(file => {
            const filePath = path.join(inboxPath, file);
            return fs.statSync(filePath).isFile();
        });

        // Create snapshot data
        const snapshot = {
            source: 'process_endpoint',
            event: 'inbox_snapshot',
            timestamp: new Date().toISOString(),
            path: inboxPath,
            items: files.map(filename => {
                const filePath = path.join(inboxPath, filename);
                const stats = fs.statSync(filePath);
                return {
                    name: filename,
                    type: 'file',
                    size: stats.size,
                    modified: stats.mtime.toISOString()
                };
            }),
            status: 'unprocessed'
        };

        // Save snapshot
        const snapshotFilename = `${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const snapshotPath = path.join(snapshotDir, snapshotFilename);

        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        console.log(`[SNAPSHOT] Saved: ${snapshotFilename}`);

        lastSnapshotTime = new Date().toISOString();

        return { success: true, snapshotPath, fileCount: files.length };

    } catch (err) {
        console.error('[ERROR] Snapshot error:', err.message);
        throw err;
    }
}

// Minimal presenter regeneration for Beta-1: include optional mailroom routing info in TRUST_HEADER.
function regeneratePresenter(snapshotResult) {
    try {
        // Use canonical presenter directory (not runtime triage) for authoritative output
        const CANONICAL_PRESENTER_DIR = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\presenter";
        const presenterDir = CANONICAL_PRESENTER_DIR;
        if (!fs.existsSync(presenterDir)) {
            fs.mkdirSync(presenterDir, { recursive: true });
            log(`[PRESENTER] Created canonical presenter directory: ${presenterDir}`);
        } else {
            log(`[PRESENTER] Using canonical presenter directory: ${presenterDir}`);
        }

        // Use a generated output directory so we never overwrite the operator-approved UI
        const generatedDir = path.join(presenterDir, 'generated');
        if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

        const rendered_at = new Date().toISOString();
        const snapshot_id = snapshotResult && snapshotResult.snapshotPath ? path.basename(snapshotResult.snapshotPath) : 'UNKNOWN';
        const items_processed = (snapshotResult && typeof snapshotResult.fileCount === 'number') ? snapshotResult.fileCount : 'UNKNOWN';
        const mailroom_info = snapshotResult && snapshotResult.mailroom ? snapshotResult.mailroom : null;
        const routed_to = mailroom_info && mailroom_info.routed_to ? mailroom_info.routed_to : null;

        const trust_header = {
            rendered_at,
            snapshot_id,
            items_processed,
            routed_to: routed_to || null
        };

        const simpleHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <title>NAVI Mail Room Update (preview)</title>\n    <style>body{font-family:Segoe UI,Arial,sans-serif;padding:24px;background:#0a0e27;color:#f0f0f0}</style>\n</head>\n<body>\n<!-- TRUST_HEADER\nrendered_at: ${rendered_at}\nsnapshot_id: ${snapshot_id}\nitems_processed: ${items_processed}${routed_to ? `\nmailroom_routed_to: ${routed_to}` : ''}\n-->\n<div class="container">\n  <h1>NAVI Mail Room Update (preview)</h1>\n  <p>Snapshot: ${snapshot_id}</p>\n  <p>Items: ${items_processed}</p>\n  ${routed_to ? `<p>Routed to: ${routed_to}</p>` : ''}\n</div>\n</body>\n</html>`;

        // Write JSON atomically to generated/presenter.json
        const jsonTmp = path.join(generatedDir, 'presenter.json.tmp');
        const jsonPath = path.join(generatedDir, 'presenter.json');
        const previewTmp = path.join(generatedDir, 'index.html.tmp');
        const previewPath = path.join(generatedDir, 'index.html');

        // Build per-file items array using snapshot file and per-file meta files
        let items = [];
        try {
            const snapshotPath = snapshotResult && snapshotResult.snapshotPath ? snapshotResult.snapshotPath : null;
            let snapshotItems = [];
            if (snapshotPath && fs.existsSync(snapshotPath)) {
                try {
                    const sdata = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
                    snapshotItems = Array.isArray(sdata.items) ? sdata.items : [];
                } catch (e) {
                    log(`[WARN] Failed to read snapshot for presenter enrichment: ${e.message}`);
                }
            }

            const agentsDir = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\agents";

            for (const sItem of snapshotItems) {
                const filename = sItem.name;
                const file_type = path.extname(filename).replace('.', '').toUpperCase();
                const received = sItem.modified ? sItem.modified.split('T')[0] : null;

                // find per-file meta in agents/*/inbox/<filename>.meta.json
                let meta = null;
                let metaPath = null;
                if (fs.existsSync(agentsDir)) {
                    const agents = fs.readdirSync(agentsDir);
                    for (const agent of agents) {
                        const candidate = path.join(agentsDir, agent, 'inbox', filename + '.meta.json');
                        if (fs.existsSync(candidate)) {
                            try {
                                meta = JSON.parse(fs.readFileSync(candidate, 'utf8'));
                                metaPath = path.relative(presenterDir, candidate).replace(/\\/g, '/');
                                break;
                            } catch (e) {
                                // ignore parse errors and continue searching
                            }
                        }
                    }
                }

                // Compute checksum fallback if meta is missing but file exists in inbox
                let checksum = meta && meta.checksum_sha256 ? meta.checksum_sha256 : null;
                const inboxFile = path.join(INBOX_DIR, filename);
                if (!checksum && fs.existsSync(inboxFile)) {
                    try {
                        const crypto = require('crypto');
                        const buf = fs.readFileSync(inboxFile);
                        checksum = crypto.createHash('sha256').update(buf).digest('hex');
                    } catch (e) {
                        log(`[WARN] Failed to compute checksum for ${inboxFile}: ${e.message}`);
                    }
                }

                items.push({
                    filename: filename || 'Unknown File',
                    routed_to: (meta && meta.routed_to) ? meta.routed_to : 'UNKNOWN',
                    confidence: (meta && meta.confidence) ? meta.confidence : null,
                    file_type: file_type || null,
                    received: received || null,
                    meta_path: metaPath || null,
                    checksum_sha256: checksum || null
                });
            }
        } catch (e) {
            log(`[WARN] Failed to build per-file items: ${e.message}`);
        }

        // Update items_processed to reflect actual items
        trust_header.items_processed = items.length;

        const data = {
            trust_header,
            items,
            html_preview: simpleHtml
        };

        try {
            fs.writeFileSync(jsonTmp, JSON.stringify(data, null, 2), 'utf8');
            fs.renameSync(jsonTmp, jsonPath);
            log(`[PRESENTER] Wrote generated JSON: ${jsonPath}`);

            lastPresenterTime = new Date().toISOString();
        } catch (jErr) {
            log(`[ERROR] Failed to write presenter JSON: ${jErr.message}`);
            if (fs.existsSync(jsonTmp)) try { fs.unlinkSync(jsonTmp); } catch(e){}
            throw jErr;
        }

        try {
            fs.writeFileSync(previewTmp, simpleHtml, 'utf8');
            fs.renameSync(previewTmp, previewPath);
            log(`[PRESENTER] Wrote generated HTML preview: ${previewPath}`);
        } catch (hErr) {
            log(`[ERROR] Failed to write generated preview HTML: ${hErr.message}`);
            if (fs.existsSync(previewTmp)) try { fs.unlinkSync(previewTmp); } catch(e){}
            throw hErr;
        }

        log(`[PRESENTER] Items for presenter: ${JSON.stringify(items, null, 2)}`);
        log(`[PRESENTER] Regenerated presenter assets (no overwrite of approved UI)`);
        return { presenter: previewPath, rendered_at, snapshot_id, items_processed, routed_to };
    } catch (e) {
        log(`[ERROR] Presenter regeneration failed: ${e.message}`);
        log(`Stack: ${e.stack}`);
        // Additional diagnostic: list presenter dir
        try {
            const presenterDir = path.join(__dirname, 'NAVI', 'presenter');
            if (fs.existsSync(presenterDir)) {
                const items = fs.readdirSync(presenterDir).map(f => ({ name: f, size: fs.statSync(path.join(presenterDir, f)).size }));
                log(`[PRESENTER] Presenter dir contents: ${JSON.stringify(items)}`);
            } else {
                log(`[PRESENTER] Presenter dir does not exist: ${presenterDir}`);
            }
        } catch (diagErr) {
            log(`[WARN] Failed to list presenter dir for diagnostics: ${diagErr.message}`);
        }

        throw e;
    }
}

// Global error handlers
process.on('uncaughtException', (err) => {
    log('[ERROR] Uncaught Exception: ' + err.message);
    log('Stack: ' + err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    log('[ERROR] Unhandled Rejection at: ' + promise + ' reason: ' + reason);
});

function serveStaticFile(req, res, baseDir, urlPath) {
  try {
    // strip querystring
    const cleanPath = (urlPath || '').split('?')[0];

    // map "/presenter/..." to file path inside baseDir
    const rel = cleanPath.replace(/^\/presenter\/?/, '');
    const filePath = path.join(baseDir, rel);

    // prevent path traversal
    const resolvedBase = path.resolve(baseDir);
    const resolvedFile = path.resolve(filePath);
    if (!resolvedFile.startsWith(resolvedBase)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Forbidden');
    }

    if (!fs.existsSync(resolvedFile) || fs.statSync(resolvedFile).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }

    const ext = path.extname(resolvedFile).toLowerCase();
    const ct = MIME_TYPES[ext] || 'application/octet-stream';

    const buf = fs.readFileSync(resolvedFile);
    res.writeHead(200, {
      'Content-Type': ct,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(buf);
    }
  } catch (err) {
    console.error('[PRESENTER] serveStaticFile error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
}

// NOTE: Startup messages are emitted by startServer() so they only appear when the HTTP server
// is actually started (guards prevent duplicate listen() calls and noisy logs when this module
// is required by other code).
const server = http.createServer((req, res) => {
    // Process inbox endpoint - triggers full pipeline
    if (req.method === 'POST' && req.url === '/process') {
        const lockFile = path.join(__dirname, 'process.lock');

        // Check if already running
        if (fs.existsSync(lockFile)) {
            console.log('[LOCK] Process already running, skipping');
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'conflict',
                message: 'Process already running',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // Create lock file
        try {
            fs.writeFileSync(lockFile, new Date().toISOString());
            console.log('[LOCK] Process lock created');
        } catch (lockError) {
            console.error('[ERROR] Failed to create lock file:', lockError.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'error',
                error: 'Failed to create lock file',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        console.log('[MCP] Processing inbox request received');

        try {
            // 1. Take snapshot (simulate MCP list_directory call)
            console.log('[SNAPSHOT] Taking snapshot...');
            const snapshotResult = takeSnapshot();
            console.log('[SNAPSHOT] Snapshot taken:', snapshotResult);

            // 2. Regenerate presenter from snapshot immediately (Beta-0 trust mode)
            // 2. Run mailroom (snapshot already taken)
            // In Beta-1 we run mailroom by default; BETA0_TRUST_MODE=true will skip mailroom and keep Beta-0 behaviour.
            let mailroomInfo = null;
            if (BETA0_TRUST_MODE) {
                // In Beta-0 trust mode we **do not** run mailroom routing — we only validate regeneration
                log('[BETA0] Trust mode active: skipping mailroom routing');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    message: 'Snapshot taken and presenter regenerated (Beta-0 trust mode, routing skipped)',
                    timestamp: new Date().toISOString()
                }));

                return;
            }

            try {
                console.log('[MAILROOM] Running mailroom...');
                const MAILROOM = path.join(__dirname, '..', 'mailroom_runner.py');

                // Capture stdout so mailroom can return JSON metadata about routing
const proc = spawnSync(PYTHON, [MAILROOM], { encoding: 'utf8' });
          const out = (proc.stdout || '').trim();
          const err = (proc.stderr || '').trim();
          log('[MAILROOM] Completed successfully. Output: ' + out);
          if (err) log('[MAILROOM] Stderr: ' + err);
          try {
              mailroomInfo = JSON.parse(out);
          } catch (e) {
              log('[MAILROOM] Warning: could not parse mailroom output as JSON: ' + e.message);
                }

                // Run router to generate metadata files and enforce agent contract (Beta-1 POC)
                try {
                    const ROUTER = path.join(__dirname, '..', 'router.js');
                    const proc = spawnSync('node', [ROUTER], { encoding: 'utf8' });
                    const routOut = (proc.stdout || '').trim();
                    const routErr = (proc.stderr || '').trim();
                    log('[ROUTER] Completed successfully. Output: ' + routOut);
                    if (routErr) log('[ROUTER] Stderr: ' + routErr);
                    try {
                        // optional: expose router result if needed
                        const routInfo = JSON.parse(routOut);
                        log(`[ROUTER] Routed ${routInfo.routed_files.length} files to ${routInfo.routed_to}`);
                    } catch (e) {
                        log('[ROUTER] Warning: could not parse router output as JSON: ' + e.message);
                    }
                } catch (rErr) {
                    log('[WARN] Router execution failed: ' + rErr.message);
                }

            } catch (mailErr) {
                log('[WARN] Mailroom execution failed: ' + mailErr.message);
                log('Stack: ' + (mailErr.stack || 'n/a'));
                // If strict mode, fail the request; otherwise proceed and keep trust regeneration information
                if ((process.env.MAILROOM_STRICT || '0') === '1') {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'error',
                        error: 'Mailroom execution failed',
                        message: mailErr.message,
                        timestamp: new Date().toISOString()
                    }));
                    return;
                } else {
                    log('[MAILROOM] Non-strict mode: continuing despite mailroom failure');
                }
            }

            // Regenerate presenter again to include any mailroom routing metadata (optional in Beta-1)
            try {
                const presInfo = regeneratePresenter(Object.assign({}, snapshotResult, { mailroom: mailroomInfo }));
                log(`PROCESS_OK snapshot=${presInfo.snapshot_id} presenter=${presInfo.presenter} rendered_at=${presInfo.rendered_at} mailroom=${mailroomInfo ? JSON.stringify(mailroomInfo) : 'none'}`);
            } catch (presErr) {
                console.error('[ERROR] Presenter regeneration failed: ' + presErr.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'error',
                    error: 'Presenter regeneration failed',
                    message: presErr.message,
                    timestamp: new Date().toISOString()
                }));
                return;
            }

            // Return success
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                message: 'Snapshot taken and mailroom executed',
                timestamp: new Date().toISOString()
            }));

        } catch (err) {
            console.error('[ERROR] Pipeline error:', err.message);
            if (err.stdout) console.error('[PIPELINE STDOUT] ' + err.stdout.toString());
            if (err.stderr) console.error('[PIPELINE STDERR] ' + err.stderr.toString());
            console.error('Stack:', err.stack);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'error',
                error: err.message,
                stdout: err.stdout ? err.stdout.toString() : null,
                stderr: err.stderr ? err.stderr.toString() : null,
                timestamp: new Date().toISOString()
            }));
        } finally {
            // Always remove lock file
            try {
                if (fs.existsSync(lockFile)) {
                    fs.unlinkSync(lockFile);
                    console.log('[LOCK] Process lock removed');
                }
            } catch (unlockError) {
                console.error('[ERROR] Failed to remove lock file:', unlockError.message);
            }
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/mcp') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                log('[MCP] Received request at /mcp');
                const parsed = JSON.parse(body);
                log('Parsed body: ' + JSON.stringify(parsed));

                const { jsonrpc, id, method, params } = parsed;

                if (method === 'tools/call' && params.name === 'list_directory') {
                    const { path: dirPath } = params.arguments;

                    log(`list_directory called: ${dirPath}`);

                    // Security check
                    const requestedPath = normalizePath(dirPath);
                    if (!isPathAllowed(requestedPath)) {
                        log(`Access denied for path: ${requestedPath}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            result: {
                                operation: "list_directory",
                                path: dirPath,
                                error: "Access denied",
                                success: false
                            },
                            id
                        }));
                        return;
                    }

                    if (!fs.existsSync(requestedPath)) {
                        log(`Directory not found: ${requestedPath}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            result: {
                                operation: "list_directory",
                                path: dirPath,
                                error: "Directory not found",
                                success: false
                            },
                            id
                        }));
                        return;
                    }

                    log(`Listing directory: ${requestedPath}`);
                    
                    // List directory contents
                    const items = fs.readdirSync(requestedPath).map(item => {
                        const fullPath = path.join(requestedPath, item);
                        const stats = fs.statSync(fullPath);
                        return {
                            name: item,
                            type: stats.isDirectory() ? 'directory' : 'file',
                            path: fullPath,
                            size: stats.size,
                            modified: stats.mtime.toISOString()
                        };
                    });

                    log(`Found ${items.length} items`);

                    // 📸 SNAPSHOT WRITER - This is the critical functionality
                    try {
                        if (!fs.existsSync(SNAPSHOT_DIR)) {
                            fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
                            log(`Created snapshot directory: ${SNAPSHOT_DIR}`);
                        }

                        const snapshot = {
                            source: "NAVI",
                            event: "inbox_snapshot", 
                            timestamp: new Date().toISOString(),
                            path: requestedPath,
                            items: items.map(item => ({
                                name: item.name,
                                type: item.type,
                                size: item.size,
                                modified: item.modified
                            })),
                            status: "unprocessed"
                        };

                        const snapshotFilename = `${snapshot.timestamp.replace(/[:.]/g, '-')}.json`;
                        const snapshotPath = path.join(SNAPSHOT_DIR, snapshotFilename);
                        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
                        
                        log(`[SNAPSHOT] Written: ${snapshotPath}`);
                    } catch (snapshotError) {
                        log(`[WARN] Snapshot write failed: ${snapshotError.message}`);
                    }

                    // Return raw data
                    const result = {
                        operation: "list_directory",
                        path: dirPath,
                        items: items.map(item => ({
                            name: item.name,
                            type: item.type,
                            size: item.size,
                            modified: item.modified
                        }))
                    };
                    
                    log(`Returning result with ${result.items.length} items`);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        jsonrpc: '2.0',
                        result: result,
                        id
                    }));
                } else {
                    log(`Method not found: ${method}`);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        jsonrpc: '2.0',
                        error: { code: -32601, message: 'Method not found' },
                        id
                    }));
                }

            } catch (err) {
                log('MCP request error: ' + err.message);
                log('Stack: ' + err.stack);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    jsonrpc: '2.0',
                    error: { code: -32603, message: err.message },
                    id: null
                }));
            }
        });
    } else if ((req.method === 'GET' || req.method === 'HEAD') && req.url.startsWith('/presenter')) {
        // Serve static files from the canonical presenter folder (operator-approved UI)
        try {
            const urlPath = req.url.split('?')[0];
            let rel = urlPath.replace(/^\/presenter/, '') || '/index.html';
            if (rel === '' || rel === '/') rel = '/index.html';
            // Use canonical presenter directory to ensure operator-approved UI is served
            const presenterDir = PRESENTER_DIR;
            let filePath = path.join(presenterDir, rel);
            filePath = path.normalize(filePath);

            // Security: ensure we're inside the presenter directory
            if (!filePath.startsWith(path.normalize(presenterDir))) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('Forbidden');
                return;
            }

            if (!fs.existsSync(filePath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not found');
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.svg': 'image/svg+xml',
                '.woff2': 'font/woff2',
                '.woff': 'font/woff',
                '.ttf': 'font/ttf'
            };
            const mime = mimeTypes[ext] || 'application/octet-stream';



            res.writeHead(200, {
              'Content-Type': mime,
              'Cache-Control': 'no-store'
            });

            if (req.method === 'HEAD') {
              res.end();
            } else {
              const data = fs.readFileSync(filePath);
              res.end(data);
            }
        } catch (err) {
            log('[ERROR] Serving presenter file: ' + err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    } else if (process.env.ENABLE_TEST_ADMIN === '1' && req.method === 'POST' && req.url && req.url.indexOf('/__mcp_shutdown') === 0) {
        try {
            const u = new URL(req.url, `http://localhost:${PORT}`);
            const token = u.searchParams.get('token') || '';
            const expected = process.env.MCP_SHUTDOWN_TOKEN || 'TEST_SHUTDOWN';
            if (token !== expected) {
                res.writeHead(403); res.end('Forbidden');
                return;
            }
        } catch (e) {
            // malformed URL - reject
            res.writeHead(400); res.end('Bad Request');
            return;
        }

        // Respond quickly, then perform graceful shutdown
        res.writeHead(200); res.end('Shutting down');
        console.log('[MCP] Shutdown endpoint invoked via admin token');
        try {
            // Use centralized graceful shutdown helper to avoid duplication
            gracefulShutdown('admin_shutdown', 0, 5000);
        } catch (e) {
            console.error('[MCP] Error during admin shutdown:', e);
            try { removePidFile(); } catch(e){}
            process.exit(1);
        }
    } else if (req.method === 'POST' && req.url === '/approval') {
        // Token-gated approval persistence endpoint (schema-validated via AJV)
        const token = (req.headers['x-mcp-approval-token'] || '').toString();
        const expected = process.env.MCP_APPROVAL_TOKEN || null;
        if (!expected) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Approval endpoint not configured on this instance' }));
            return;
        }
        if (token !== expected) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden' }));
            return;
        }

        // Read body
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            try {
                let payload;
                try {
                    payload = JSON.parse(body);
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON payload', message: e.message }));
                    return;
                }

                // Validate against JSON schema using AJV
                const valid = validateApproval(payload);
                if (!valid) {
                    const details = (validateApproval.errors || []).map(err => {
                        const path = err.instancePath || err.dataPath || '';
                        return `${path} ${err.message}`.trim();
                    });
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid payload', details }));
                    return;
                }

                // Persist approval file
                try {
                    const correctNAVI_DIR = path.join(PROJECT_ROOT, 'NAVI');
                    if (!fs.existsSync(APPROVAL_DIR)) fs.mkdirSync(APPROVAL_DIR, { recursive: true });
                    const { reviewer, status, snapshot_id, timestamp, items } = payload;
                    const dateDir = path.join(APPROVAL_DIR, new Date().toISOString().slice(0,10));
                    if (!fs.existsSync(dateDir)) fs.mkdirSync(dateDir, { recursive: true });

                    const approvalFile = `${snapshot_id}.${reviewer.replace(/[^a-z0-9]/gi, '_')}.${Date.now()}.approval.json`;
                    const approvalPath = path.join(dateDir, approvalFile);

                    try {
                        const tmp = approvalPath + '.tmp';
                        fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
                        fs.renameSync(tmp, approvalPath);

                        // Append to audit log
                        const auditPath = path.join(APPROVAL_DIR, 'audit.log');
                        const auditLine = `[${new Date().toISOString()}] ${reviewer} approved snapshot ${snapshot_id} with ${items.length} items → ${approvalFile}\n`;
                        fs.appendFileSync(auditPath, auditLine, 'utf8');

                        // Enforcement move pass
                        const moveResults = [];
                        for (const item of items) {
                            const { filename, gtd_outcome, sensitivity } = item;
                            
                            // Skip dotfiles
                            if (filename.startsWith('.')) {
                                moveResults.push({ filename, status: 'skipped', reason: 'dotfile' });
                                continue;
                            }

                            // Guard against path traversal
                            const safe = path.basename(filename);
                            if (safe !== filename) {
                                moveResults.push({ filename, status: 'error', error: 'unsafe filename' });
                                continue;
                            }

                            // Compute destBase
                            let bucket;
                            if (gtd_outcome === 'trash') {
                                bucket = 'rejected';
                            } else if (sensitivity !== 'normal') {
                                bucket = 'escalated';
                            } else {
                                bucket = 'processed';
                            }

                            const destDir = path.join(correctNAVI_DIR, bucket, snapshot_id);
                            fs.mkdirSync(destDir, { recursive: true });

                            const src = path.join(INBOX_DIR, safe);
                            let dest = path.join(destDir, safe);

                            // Avoid overwrite
                            if (fs.existsSync(dest)) {
                                const ext = path.extname(filename);
                                const base = path.basename(filename, ext);
                                let counter = 1;
                                do {
                                    dest = path.join(destDir, `${base}.dup-${counter}${ext}`);
                                    counter++;
                                } while (fs.existsSync(dest));
                            }

                            if (!fs.existsSync(src)) {
                                moveResults.push({ filename, status: 'missing' });
                                continue;
                            }

                            try {
                                // Try rename first
                                fs.renameSync(src, dest);
                                moveResults.push({ filename, status: 'moved', to: dest, bucket });
                            } catch (moveErr) {
                                try {
                                    // Fallback to copy + unlink
                                    fs.copyFileSync(src, dest);
                                    fs.unlinkSync(src);
                                    moveResults.push({ filename, status: 'moved', to: dest, bucket, method: 'copy+unlink' });
                                } catch (fallbackErr) {
                                    moveResults.push({ filename, status: 'error', error: fallbackErr.message });
                                }
                            }
                        }

                        // Compute summary counts
                        const moved_processed = moveResults.filter(r => r.bucket === 'processed').length;
                        const moved_escalated = moveResults.filter(r => r.bucket === 'escalated').length;
                        const moved_rejected = moveResults.filter(r => r.bucket === 'rejected').length;
                        const missing_count = moveResults.filter(r => r.status === 'missing').length;
                        const error_count = moveResults.filter(r => r.status === 'error').length;

                        res.writeHead(201, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: true, file: approvalPath, move_results: moveResults, moved_processed, moved_escalated, moved_rejected, missing_count, error_count }));
                        console.log('[MCP] Approval persisted:', approvalPath);
                    } catch (writeErr) {
                        console.error('[MCP] Failed to write approval file:', writeErr);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to persist approval' }));
                    }
                } catch (dirErr) {
                    console.error('[MCP] Failed to create approval directory:', dirErr);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to create approval directory' }));
                }
            } catch (e) {
                console.error('[MCP] Approval processing error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
    } else if (req.method === 'GET' && req.url === '/approvals/audit') {
        // Serve approvals audit log (basic visibility)
        try {
            const auditPath = path.join(APPROVAL_DIR, 'audit.log');
            if (!fs.existsSync(auditPath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('audit.log not found');
                return;
            }
            const content = fs.readFileSync(auditPath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(content);
            return;
        } catch (e) {
            log('[ERROR] Serving approvals audit log: ' + (e && e.message));
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
            return;
        }
    } else if (req.method === 'GET' && req.url === '/health') {
        // Minimal health endpoint for monitoring
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            ok: true,
            pid: process.pid,
            uptime: process.uptime(),
            snapshot_last: lastSnapshotTime,
            presenter_last: lastPresenterTime,
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

let serverStarted = false;

function startServer() {
    // Diagnostic: log the full invocation stack every time startServer() is called
    try {
        const stack = new Error('[MCP] startServer invoked').stack;
        // Skip the first two frames (this line and Error constructor) for clarity
        console.log('[MCP] startServer invoked\n' + stack.split('\n').slice(2).join('\n'));
    } catch (e) {
        console.warn('[MCP] Failed to capture startServer stack: ' + (e && e.message));
    }

    // Defensive: if the underlying HTTP server is already listening, skip.
    if (server.listening) {
        console.warn('[MCP] Server already listening — skipping');
        console.warn(new Error('[MCP] startServer called while server already listening').stack);
        serverStarted = true;
        return;
    }

    if (serverStarted) {
        console.warn('[MCP] Server already started — skipping');
        console.warn(new Error('[MCP] startServer called again').stack);
        return;
    }

    serverStarted = true;

    // Emit authoritative startup messages only when we are actually starting the HTTP server
    console.log('[MCP] Starting VBoarder MCP Filesystem Server...');
    console.log('[MCP] Allowed directories:');
    console.log('   D:\\05_AGENTS');
    console.log('   D:\\05_AGENTS-AI');
    console.log('   D:\\01_SYSTEM');
    console.log('   D:\\02_SOFTWARE\\01_AI_MODELS');
    console.log(`[MCP] Server will listen on port ${PORT}`);
    console.log(`[MCP] Configure client to use: http://localhost:${PORT}/mcp`);

    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            console.error(`[FATAL] Port ${PORT} already in use. Exiting to avoid restart loop.`);
            process.exit(1);
        } else {
            console.error('[ERROR] Server error:', err);
        }
    });

    // PID-file guard uses module-level helpers (see top of file)


    // If a pidfile exists and the PID is alive, fail fast to avoid port collisions
    if (fs.existsSync(pidFile)) {
        try {
            const existing = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
            if (!isNaN(existing)) {
                try {
                    process.kill(existing, 0); // check if process exists
                    console.error(`[FATAL] PID file exists and process ${existing} is running. Exiting to avoid duplicate instance.`);
                    process.exit(1);
                } catch (err) {
                    log(`[WARN] Stale PID file found for ${existing}, removing`);
                    try { fs.unlinkSync(pidFile); } catch(e){}
                }
            } else {
                log('[WARN] PID file present but content is invalid; removing');
                try { fs.unlinkSync(pidFile); } catch(e){}
            }
        } catch (e) {
            log('[WARN] Could not parse PID file; removing: ' + e.message);
            try { fs.unlinkSync(pidFile); } catch(e){}
        }
    }

    // Write our PID and set up cleanup hooks
    try {
        fs.writeFileSync(pidFile, String(process.pid), 'utf8');
        log(`[MCP] Wrote PID ${process.pid} to ${pidFile}`);
    } catch (e) {
        console.error('[WARN] Failed to write PID file: ' + e.message);
    }

    process.on('exit', removePidFile);
    process.on('SIGTERM', () => {
        console.log('[MCP] SIGTERM received - initiating graceful shutdown');
        // Centralized graceful shutdown implementation
        gracefulShutdown('SIGTERM', 0, 5000);
    });

    try {
        server.listen(PORT, () => {
            console.log('[MCP] Server connected and ready');
        });
    } catch (e) {
        // Synchronous listen errors (e.g., EADDRINUSE) will be handled here as backup
        console.error('[ERROR] Server failed to start:', e);
        if (e && e.code === 'EADDRINUSE') {
            console.error(`[FATAL] Port ${PORT} already in use. Exiting to avoid restart loop.`);
            removePidFile();
            process.exit(1);
        }
        removePidFile();
        throw e;
    }
}

// Centralized graceful shutdown helper used by signal handlers and admin endpoint
function gracefulShutdown(reason, exitCode = 0, timeoutMs = 5000) {
    console.log(`[MCP] Initiating graceful shutdown: ${reason}`);
    try {
        if (server && typeof server.close === 'function') {
            let closed = false;
            server.close(() => {
                closed = true;
                console.log(`[MCP] server.close complete (${reason})`);
                try { removePidFile(); } catch (e) { console.error('[MCP] PID remove failed during shutdown', e); }
                process.exit(exitCode);
            });
            // Fallback in case server.close hangs
            setTimeout(() => {
                if (!closed) {
                    console.warn(`[MCP] server.close fallback: removing PID and exiting (${reason})`);
                    try { removePidFile(); } catch (e) { console.error('[MCP] PID remove fallback failed', e); }
                    process.exit(exitCode);
                }
            }, timeoutMs);
        } else {
            try { removePidFile(); } catch(e) { console.error('[MCP] PID remove failed during shutdown', e); }
            process.exit(exitCode);
        }
    } catch (e) {
        console.error('[MCP] Error during shutdown handler (' + reason + '):', e);
        try { removePidFile(); } catch(e){}
        process.exit(1);
    }
}

// Start server only when this module is executed directly (single entry point)
if (require.main === module) {
    startServer();
}

// Keep the process alive
setInterval(() => {
    // Keep alive
}, 1000);

// Handle process termination
process.on('SIGINT', () => {
    console.log('[MCP] Shutting down MCP server (SIGINT)...');
    gracefulShutdown('SIGINT', 0, 5000);
});