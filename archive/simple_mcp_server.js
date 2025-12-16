#!/usr/bin/env node

const express = require('express');
const fs = require('fs');
const path = require('path');

// Configuration
const INBOX_DIR = "D:\\05_AGENTS-AI\\VBoarder_Core\\NAVI\\inbox";
const SNAPSHOT_DIR = "D:\\05_AGENTS-AI\\VBoarder_Core\\NAVI\\snapshots\\inbox";

// Utility functions
function normalizePath(p) {
  return path.normalize(p).toLowerCase();
}

function isPathAllowed(filePath) {
    const normalizedPath = path.normalize(filePath);
    const allowedPaths = [
        'D:\\05_AGENTS',
        'D:\\05_AGENTS-AI',
        'D:\\01_SYSTEM',
        'D:\\02_SOFTWARE\\01_AI_MODELS'
    ];
    return allowedPaths.some(allowedPath =>
        normalizedPath.startsWith(allowedPath)
    );
}

function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

async function main() {
    // Global error handlers
    process.on('uncaughtException', (err) => {
        console.error('❌ Uncaught Exception:', err);
        console.error('Stack:', err.stack);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Create Express app
    const app = express();
    app.use(express.json({ limit: '5mb' }));

    // MCP tool handler
    app.post('/mcp', async (req, res) => {
        console.log('🔥 Received request at /mcp');
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Body:', JSON.stringify(req.body, null, 2));
        
        try {
            const { jsonrpc, id, method, params } = req.body;

            if (method === 'tools/call' && params.name === 'list_directory') {
                const { path: dirPath } = params.arguments;

                log(`list_directory called: ${dirPath}`);

                // Security check
                const requestedPath = normalizePath(dirPath);
                if (!isPathAllowed(requestedPath)) {
                    return res.json({
                        jsonrpc: '2.0',
                        result: {
                            operation: "list_directory",
                            path: dirPath,
                            error: "Access denied",
                            success: false
                        },
                        id
                    });
                }

                if (!fs.existsSync(requestedPath)) {
                    return res.json({
                        jsonrpc: '2.0',
                        result: {
                            operation: "list_directory",
                            path: dirPath,
                            error: "Directory not found",
                            success: false
                        },
                        id
                    });
                }

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

                // 📸 SNAPSHOT WRITER - This is the critical functionality
                try {
                    if (!fs.existsSync(SNAPSHOT_DIR)) {
                        fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
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
                return res.json({
                    jsonrpc: '2.0',
                    result: {
                        operation: "list_directory",
                        path: dirPath,
                        items: items.map(item => ({
                            name: item.name,
                            type: item.type,
                            size: item.size,
                            modified: item.modified
                        }))
                    },
                    id
                });
            }

            // Method not found
            res.json({
                jsonrpc: '2.0',
                error: { code: -32601, message: 'Method not found' },
                id
            });

        } catch (err) {
            console.error('MCP request error:', err);            console.error('Stack:', err.stack);            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32603, message: err.message },
                id: req.body?.id || null
            });
        }
    });

    const PORT = 8005;

    console.log('🚀 Starting VBoarder MCP Filesystem Server...');
    console.log('📁 Allowed directories:');
    console.log('   D:\\05_AGENTS');
    console.log('   D:\\05_AGENTS-AI');
    console.log('   D:\\01_SYSTEM');
    console.log('   D:\\02_SOFTWARE\\01_AI_MODELS');
    console.log(`🌐 Server will listen on port ${PORT}`);
    console.log(`🔗 Configure LobeChat to use: http://localhost:${PORT}/mcp`);

    // Start the HTTP server
    app.listen(PORT, () => {
        console.log('✅ MCP server connected and ready!');
    }).on('error', (error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });

    // Keep the process alive
    setInterval(() => {}, 1000);
}

main().catch(error => {
    console.error('❌ Server error:', error);
    console.error('Stack:', error.stack);
    // Don't exit, just log
});