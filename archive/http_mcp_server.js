const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const INBOX_DIR = "D:\\05_AGENTS-AI\\VBoarder_Core\\NAVI\\inbox";
const SNAPSHOT_DIR = "D:\\05_AGENTS-AI\\VBoarder_Core\\NAVI\\snapshots\\inbox";

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

// Global error handlers
process.on('uncaughtException', (err) => {
    log('❌ Uncaught Exception: ' + err.message);
    log('Stack: ' + err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    log('❌ Unhandled Rejection at: ' + promise + ' reason: ' + reason);
});

console.log('🚀 Starting VBoarder MCP Filesystem Server...');
console.log('📁 Allowed directories:');
console.log('   D:\\05_AGENTS');
console.log('   D:\\05_AGENTS-AI');
console.log('   D:\\01_SYSTEM');
console.log('   D:\\02_SOFTWARE\\01_AI_MODELS');
console.log(`🌐 Server will listen on port 8005`);
console.log(`🔗 Configure LobeChat to use: http://localhost:8005/mcp`);

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/mcp') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                log('🔥 Received request at /mcp');
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
                        
                        log(`📸 Snapshot written: ${snapshotPath}`);
                    } catch (snapshotError) {
                        log(`⚠️ Snapshot write failed: ${snapshotError.message}`);
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
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(8005, () => {
    console.log('✅ MCP server connected and ready!');
});

// Keep the process alive
setInterval(() => {}, 1000);