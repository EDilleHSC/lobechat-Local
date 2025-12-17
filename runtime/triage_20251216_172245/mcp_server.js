const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Explicit Python runtime for predictable execution
const PYTHON = 'D:\\Python312\\python.exe';
// Beta-0 trust mode: when true, regenerate presenter from snapshot and skip routing/mailroom
const BETA0_TRUST_MODE = (process.env.BETA0_TRUST_MODE || '1') === '1'; // default ON for Beta-0 workflow

// Configuration
const INBOX_DIR = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\inbox";
const SNAPSHOT_DIR = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\snapshots\\inbox";

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

        return { success: true, snapshotPath, fileCount: files.length };

    } catch (err) {
        console.error('[ERROR] Snapshot error:', err.message);
        throw err;
    }
}

// Minimal presenter regeneration for Beta-0: create a simple index.html with a TRUST_HEADER.
function regeneratePresenter(snapshotResult) {
    try {
        // Use canonical presenter directory (not runtime triage) for Beta-0 authoritative output
        const CANONICAL_PRESENTER_DIR = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI\\presenter";
        const presenterDir = CANONICAL_PRESENTER_DIR;
        if (!fs.existsSync(presenterDir)) {
            fs.mkdirSync(presenterDir, { recursive: true });
            log(`[PRESENTER] Created canonical presenter directory: ${presenterDir}`);
        } else {
            log(`[PRESENTER] Using canonical presenter directory: ${presenterDir}`);
        }

        const outputPath = path.join(presenterDir, 'index.html');
        const tmpPath = path.join(presenterDir, 'index.html.tmp');
        const rendered_at = new Date().toISOString();
        const snapshot_id = snapshotResult && snapshotResult.snapshotPath ? path.basename(snapshotResult.snapshotPath) : 'UNKNOWN';
        const items_processed = (snapshotResult && typeof snapshotResult.fileCount === 'number') ? snapshotResult.fileCount : 'UNKNOWN';

        const trust_header = `<!-- TRUST_HEADER\nrendered_at: ${rendered_at}\nsnapshot_id: ${snapshot_id}\nitems_processed: ${items_processed}\n-->`;

        const simpleHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <title>NAVI Mail Room Update</title>\n    <style>body{font-family:Segoe UI,Arial,sans-serif;padding:24px;background:#0a0e27;color:#f0f0f0}</style>\n</head>\n<body>\n${trust_header}\n<div class="container">\n  <h1>NAVI Mail Room Update</h1>\n  <p>Snapshot: ${snapshot_id}</p>\n  <p>Items: ${items_processed}</p>\n</div>\n</body>\n</html>`;

        // Atomic write: write tmp then rename — with explicit logging and error capture
        try {
            fs.writeFileSync(tmpPath, simpleHtml, 'utf8');
            const tmpStat = fs.existsSync(tmpPath) ? fs.statSync(tmpPath) : null;
            log(`[PRESENTER] Wrote tmp file: ${tmpPath}` + (tmpStat ? ` (${tmpStat.size} bytes, mtime=${tmpStat.mtime.toISOString()})` : ' (tmp not found after write)'));
        } catch (writeErr) {
            log(`[ERROR] Failed writing tmp presenter file (${tmpPath}): ${writeErr.message}`);
            log(`Stack: ${writeErr.stack}`);
            // Attempt to clean up any partial tmp file
            try {
                if (fs.existsSync(tmpPath)) {
                    fs.unlinkSync(tmpPath);
                    log(`[PRESENTER] Removed partial tmp file: ${tmpPath}`);
                }
            } catch (cleanupErr) {
                log(`[WARN] Failed to remove partial tmp file: ${cleanupErr.message}`);
            }
            throw writeErr;
        }

        try {
            fs.renameSync(tmpPath, outputPath);
            const outStat = fs.statSync(outputPath);
            log(`[PRESENTER] Renamed tmp to output: ${outputPath} (${outStat.size} bytes, mtime=${outStat.mtime.toISOString()})`);
        } catch (renameErr) {
            log(`[ERROR] Failed renaming tmp -> output (${tmpPath} -> ${outputPath}): ${renameErr.message}`);
            log(`Stack: ${renameErr.stack}`);
            // Attempt to read tmp file for diagnostics
            try {
                if (fs.existsSync(tmpPath)) {
                    const probe = fs.readFileSync(tmpPath, 'utf8').slice(0, 1024);
                    log(`[PRESENTER] Tmp file head for diagnostics (first 1KB):\n${probe}`);
                } else if (fs.existsSync(outputPath)) {
                    const probe = fs.readFileSync(outputPath, 'utf8').slice(0, 1024);
                    log(`[PRESENTER] Output file unexpectedly present (first 1KB):\n${probe}`);
                }
            } catch (probeErr) {
                log(`[WARN] Failed to probe tmp/output files: ${probeErr.message}`);
            }

            // Attempt cleanup of tmp
            try {
                if (fs.existsSync(tmpPath)) {
                    fs.unlinkSync(tmpPath);
                    log(`[PRESENTER] Removed tmp file after rename failure: ${tmpPath}`);
                }
            } catch (cleanupErr) {
                log(`[WARN] Failed to remove tmp file after rename failure: ${cleanupErr.message}`);
            }

            throw renameErr;
        }

        log(`[PRESENTER] Regenerated presenter: ${outputPath}`);

        return { presenter: outputPath, rendered_at, snapshot_id, items_processed };
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

console.log('[MCP] Starting VBoarder MCP Filesystem Server...');
console.log('[MCP] Allowed directories:');
console.log('   D:\\05_AGENTS');
console.log('   D:\\05_AGENTS-AI');
console.log('   D:\\01_SYSTEM');
console.log('   D:\\02_SOFTWARE\\01_AI_MODELS');
console.log('[MCP] Server will listen on port 8005');
console.log('[MCP] Configure client to use: http://localhost:8005/mcp');

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
            try {
                const presInfo = regeneratePresenter(snapshotResult);
                log(`PROCESS_OK snapshot=${presInfo.snapshot_id} presenter=${presInfo.presenter} rendered_at=${presInfo.rendered_at}`);
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

            // 3. Run mailroom only (snapshot already taken)
            console.log('[MAILROOM] Running mailroom...');
            const MAILROOM = path.join(__dirname, '..', 'mailroom_runner.py');

            execSync(`"${PYTHON}" "${MAILROOM}"`, { stdio: 'inherit' });

            console.log('[MAILROOM] Completed');

            // Return success immediately; AIR and Presenter are handled separately
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
    } else if (req.method === 'GET' && req.url.startsWith('/presenter')) {
        // Serve static files from the presenter folder
        try {
            let rel = req.url.replace(/^\/presenter/, '') || '/index.html';
            if (rel === '' || rel === '/') rel = '/index.html';
            const presenterDir = path.join(__dirname, 'NAVI', 'presenter');
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

            // For HTML files, inject a deterministic Trust Header before serving
            if (ext === '.html') {
                try {
                    let html = fs.readFileSync(filePath, 'utf8');

                    // Deterministic values: UTC timestamp, latest snapshot filename, items count from latest snapshot
                    const rendered_at = new Date().toISOString();
                    let snapshot_id = 'UNKNOWN';
                    let items_processed = 'UNKNOWN';

                    try {
                        if (fs.existsSync(SNAPSHOT_DIR)) {
                            const snaps = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json'));
                            if (snaps.length > 0) {
                                snaps.sort();
                                const latest = snaps[snaps.length - 1];
                                snapshot_id = latest;
                                try {
                                    const sdata = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, latest), 'utf8'));
                                    if (Array.isArray(sdata.items)) {
                                        items_processed = sdata.items.length;
                                    }
                                } catch (e) {
                                    // ignore parse errors, keep UNKNOWN
                                }
                            }
                        }
                    } catch (e) {
                        // ignore snapshot read errors
                    }

                    const trust_header = `<!-- TRUST_HEADER\nrendered_at: ${rendered_at}\nsnapshot_id: ${snapshot_id}\nitems_processed: ${items_processed}\n-->`;

                    if (html.indexOf('<body>') !== -1) {
                        html = html.replace('<body>', '<body>\n' + trust_header);
                    } else {
                        html = trust_header + '\n' + html;
                    }

                    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
                    res.end(html, 'utf8');
                    return;
                } catch (e) {
                    log('[ERROR] Serving presenter HTML with Trust Header: ' + e.message);
                    // fallthrough to stream fallback
                }
            }

            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
        } catch (err) {
            log('[ERROR] Serving presenter file: ' + err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    } else if (req.method === 'GET' && req.url === '/health') {
        // Minimal health endpoint for monitoring
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(8005, () => {
    console.log('[MCP] Server connected and ready');
}).on('error', (err) => {
    console.error('[ERROR] Server failed to start:', err);
    process.exit(1);
});

// Keep the process alive
setInterval(() => {
    // Keep alive
}, 1000);

// Handle process termination
process.on('SIGINT', () => {
    console.log('[MCP] Shutting down MCP server...');
    server.close(() => {
        console.log('[MCP] Server shut down gracefully');
        process.exit(0);
    });
});