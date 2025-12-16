#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { randomUUID } = require('node:crypto');
const z = require('zod');
const fs = require('fs');
const path = require('path');
const express = require('express');

// 1️⃣ UTILITIES (top of file)
const pathModule = require("path");

/* Normalize paths so Windows casing / slashes never cause loops */
function normalizePath(p) {
  return pathModule.normalize(p).toLowerCase();
}

/* HARD rule: tool models never produce UI text */
function extractToolFacts(toolResult) {
  return {
    files: Array.isArray(toolResult?.files) ? toolResult.files : [],
    operation: toolResult?.operation || 'unknown',
    count: toolResult?.count || 0,
    success: toolResult?.success !== false
  };
}

// Directory configuration
const INBOX_DIR = "D:\\05_AGENTS-AI\\01_PRODUCTION\\OPS_INTAKE_NAVI_v2.0\\inbox";
const PROCESSING_DIR = "D:\\05_AGENTS-AI\\01_PRODUCTION\\OPS_INTAKE_NAVI_v2.0\\processing";
const ARCHIVE_DIR = "D:\\05_AGENTS-AI\\01_PRODUCTION\\OPS_INTAKE_NAVI_v2.0\\archive";

// Presenter Model: Qwen2.5-3B Configuration  
const PRESENTER_MODEL = {
    name: "qwen2.5:3b",
    endpoint: "http://localhost:11434/api/generate", // Ollama
    systemPrompt: `You are Navi Thompson, a presentation-only assistant.

Rules (non-negotiable):
- You do NOT have access to tools.
- You must NEVER call tools or output tool JSON.
- You must NEVER say "I will list", "I will check", or similar.
- You only receive pre-verified data from the system.
- Your job is to format and summarize that data for a human.

If no data is provided, say:
"I don't have inbox data yet. Please ask the system to retrieve it."`
};

// 2️⃣ Tool execution (INTERNAL ONLY)
async function runToolModel(userPrompt) {
  // This function executes tools directly (MCP server role)
  // Returns facts only - NEVER UI-ready text

  try {
    // Parse the user intent from the prompt
    const intent = parseUserIntent(userPrompt);
    
    let toolResult = { operation: intent.operation, success: false };
    
    switch (intent.operation) {
      case 'list_directory':
        const dirPath = normalizePath(intent.path || INBOX_DIR);
        if (isPathAllowed(dirPath) && fs.existsSync(dirPath)) {
          const items = fs.readdirSync(dirPath).map(item => {
            const fullPath = pathModule.join(dirPath, item);
            const stats = fs.statSync(fullPath);
            return {
              name: item,
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime.toISOString()
            };
          });
          toolResult = {
            operation: 'list_directory',
            files: items,
            count: items.length,
            success: true
          };
        }
        break;
        
      case 'read_file':
        const filePath = normalizePath(intent.path);
        if (isPathAllowed(filePath) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, 'utf8');
          toolResult = {
            operation: 'read_file',
            files: [{ name: pathModule.basename(filePath), content: content }],
            success: true
          };
        }
        break;
        
      default:
        toolResult = { operation: 'unknown', success: false };
    }
    
    return extractToolFacts(toolResult);
  } catch (error) {
    log(`Tool execution error: ${error.message}`);
    return extractToolFacts({ operation: 'error', success: false });
  }
}

// Parse user intent from natural language
function parseUserIntent(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('list') && (lowerPrompt.includes('inbox') || lowerPrompt.includes('directory'))) {
    return { operation: 'list_directory', path: INBOX_DIR };
  }
  
  if (lowerPrompt.includes('read') && lowerPrompt.includes('file')) {
    // Extract filename if mentioned
    const fileMatch = prompt.match(/read\s+(.+)\s+file/i) || prompt.match(/open\s+(.+)/i);
    const filename = fileMatch ? fileMatch[1].trim() : null;
    return { operation: 'read_file', path: filename ? pathModule.join(INBOX_DIR, filename) : null };
  }
  
  return { operation: 'list_directory', path: INBOX_DIR }; // Default to inbox listing
}

// 3️⃣ Presenter call (UI VOICE)
async function runPresenterModel(payload) {
  try {
    log(`Presenter called with payload: ${JSON.stringify(payload).substring(0, 200)}...`);
    
    const presenterPrompt = `${PRESENTER_MODEL.systemPrompt}

Data to format:
${JSON.stringify(payload, null, 2)}

Format this data cleanly for a human user. Use bullet points and light emojis. Do not mention tools or internals.`;

    log(`Calling Ollama with model ${PRESENTER_MODEL.name}`);
    const response = await fetch(PRESENTER_MODEL.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PRESENTER_MODEL.name,
        prompt: presenterPrompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 300 }
        // CRITICAL: No tools, no function schemas, no tool_choice
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    const output = result.response?.trim() || 'Operation completed successfully.';
    log(`Presenter output: ${output.substring(0, 100)}...`);
    return output;
  } catch (error) {
    log(`Presenter model error: ${error.message}`);
    return '⚠️ I ran into an issue processing your request. Please try again.';
  }
}

// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    // Could also write to file if needed
}

// UI Filtering Functions for LobeChat
function isInternalToolMessage(msg) {
    if (!msg) return false;

    return (
        msg.role === 'tool' ||
        msg.role === 'observation' ||
        msg.content?.includes('<|observation|>') ||
        msg.content?.startsWith('list_directory') ||
        msg.content?.startsWith('read_file') ||
        msg.content?.startsWith('write_file') ||
        msg.content?.startsWith('search_files')
    );
}

function extractUserFacingMessage(messages) {
    // Walk messages from the end (latest first)
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];

        if (
            msg.role === 'assistant' &&
            !isInternalToolMessage(msg)
        ) {
            return msg.content;
        }
    }

    return "⚠️ No user-facing response generated.";
}

// FIX 1: Hard filter internal messages (MANDATORY)
function isUserFacing(msg) {
    if (!msg || !msg.content) return false;

    return (
        msg.role === "assistant" &&
        !msg.content.includes("<|observation|>") &&
        !msg.content.startsWith("list_directory") &&
        !msg.content.startsWith("read_file") &&
        !msg.content.startsWith("write_file") &&
        !msg.content.startsWith("search_files")
    );
}

function cleanOutput(text) {
    return text
        .replace(/<\|observation\|>.*$/gs, '')
        .replace(/list_directory.*$/gm, '')
        .replace(/read_file.*$/gm, '')
        .replace(/write_file.*$/gm, '')
        .replace(/search_files.*$/gm, '')
        .trim();
}

// Hard path normalization (MANDATORY)
function normalizePath(inputPath) {
    return path
        .normalize(inputPath)
        .replace(/\\/g, "\\")      // normalize slashes
        .toLowerCase();            // FORCE lowercase
}

// Tool call deduplication (MANDATORY)
let toolCalledThisTurn = false;

function canCallTool(toolName, path) {
    if (toolCalledThisTurn) return false;
    toolCalledThisTurn = true;
    return true;
}

function resetToolLock() {
    toolCalledThisTurn = false;
}

// Tool execution tracking for hard-stop
let lastToolExecution = null;

// Hard-stop tool loops - check if tool was recently executed
function shouldBlockToolCall() {
    if (!lastToolExecution) return false;

    const timeSinceLastTool = Date.now() - lastToolExecution;
    const BLOCK_DURATION = 5000; // 5 seconds hard-stop after tool execution

    if (timeSinceLastTool < BLOCK_DURATION) {
        return true;
    }

    return false;
}

// Allowed directories for security
const ALLOWED_PATHS = [
    'D:\\05_AGENTS',
    'D:\\05_AGENTS-AI',
    'D:\\01_SYSTEM',
    'D:\\02_SOFTWARE\\01_AI_MODELS'
];

function isPathAllowed(filePath) {
    const normalizedPath = path.normalize(filePath);
    return ALLOWED_PATHS.some(allowedPath =>
        normalizedPath.startsWith(allowedPath)
    );
}

const getServer = () => {
    const server = new McpServer({
        name: 'vboarder-filesystem-server',
        version: '1.0.0'
    });

    // Register list_directory tool
    server.registerTool('list_directory', {
        description: 'List files and directories in a path',
        inputSchema: z.object({
            path: z.string().describe('Directory path to list')
        })
    }, async ({ path: dirPath }) => {
        log(`list_directory called: ${dirPath}`);
        
        // FIX 1: Hard path normalization
        const requestedPath = normalizePath(dirPath);
        
        // FIX 2: Tool call deduplication
        if (!canCallTool("list_directory", requestedPath)) {
            return {
                content: [{
                    type: 'text',
                    text: 'Tool already executed for this request.'
                }],
                isError: true
            };
        }
        
        // Hard-stop check - prevent tool loops
        if (shouldBlockToolCall()) {
            return {
                content: [{
                    type: 'text',
                    text: '⚠️ Tool execution complete. Do not call any additional tools unless explicitly instructed by the user.'
                }],
                isError: true
            };
        }
        
        try {
            // Use normalized path for security check
            if (!isPathAllowed(requestedPath)) {
                return {
                    content: [{
                        type: 'text',
                        text: `Access denied: ${dirPath}`
                    }],
                    isError: true
                };
            }

            if (!fs.existsSync(requestedPath)) {
                return {
                    content: [{
                        type: 'text',
                        text: `Directory not found: ${dirPath}`
                    }],
                    isError: true
                };
            }

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

            // 📸 SNAPSHOT WRITER (Single Source of Truth)
            // Write read-only JSON snapshot immediately after filesystem enumeration
            try {
                const snapshotDir = "D:\\05_AGENTS-AI\\01_PRODUCTION\\OPS_INTAKE_NAVI_v2.0\\snapshots\\inbox";
                if (!fs.existsSync(snapshotDir)) {
                    fs.mkdirSync(snapshotDir, { recursive: true });
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
                const snapshotPath = path.join(snapshotDir, snapshotFilename);
                fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
                
                log(`📸 Snapshot written: ${snapshotPath}`);
            } catch (snapshotError) {
                log(`⚠️ Snapshot write failed: ${snapshotError.message}`);
                // Continue execution - snapshot failure doesn't break tool
            }

            // Mark tool execution for hard-stop
            lastToolExecution = Date.now();

            // Return raw data only - no formatting, no presenter logic
            return {
                operation: "list_directory",
                path: dirPath,
                items: items.map(item => ({
                    name: item.name,
                    type: item.type,
                    size: item.size,
                    modified: item.modified
                }))
            };
        } catch (error) {
            log(`Error in list_directory: ${error.message}`);
            return {
                operation: "list_directory",
                path: dirPath,
                error: error.message,
                success: false
            };
        }
    });

    // Register read_file tool
    server.registerTool('read_file', {
        description: 'Read the contents of a text file',
        inputSchema: z.object({
            path: z.string().describe('File path to read')
        })
    }, async ({ path: filePath }) => {
        log(`read_file called: ${filePath}`);
        
        // FIX 1: Hard path normalization
        const requestedPath = normalizePath(filePath);
        
        // FIX 2: Tool call deduplication
        if (!canCallTool("read_file", requestedPath)) {
            return {
                content: [{
                    type: 'text',
                    text: 'Tool already executed for this request.'
                }],
                isError: true
            };
        }
        
        // Hard-stop check - prevent tool loops
        if (shouldBlockToolCall()) {
            return {
                content: [{
                    type: 'text',
                    text: '⚠️ Tool execution complete. Do not call any additional tools unless explicitly instructed by the user.'
                }],
                isError: true
            };
        }
        
        try {
            // Use normalized path for security check
            if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
                return {
                    content: [{
                        type: 'text',
                        text: `File not found: ${filePath}`
                    }],
                    isError: true
                };
            }

            if (!isPathAllowed(requestedPath)) {
                return {
                    content: [{
                        type: 'text',
                        text: `Access denied: ${filePath}`
                    }],
                    isError: true
                };
            }

            const content = fs.readFileSync(requestedPath, 'utf8');
            
            // Mark tool execution for hard-stop
            lastToolExecution = Date.now();

            // Return raw data only
            const fileName = path.basename(requestedPath);
            return {
                operation: "read_file",
                file: fileName,
                path: requestedPath,
                content: content,
                size: fs.statSync(requestedPath).size
            };
        } catch (error) {
            log(`Error in read_file: ${error.message}`);
            return {
                operation: "read_file",
                path: filePath,
                error: error.message,
                success: false
            };
        }
    });

    // Register write_file tool
    server.registerTool('write_file', {
        description: 'Write or create a text file',
        inputSchema: z.object({
            path: z.string().describe('File path to write'),
            content: z.string().describe('Content to write to the file')
        })
    }, async ({ path: filePath, content }) => {
        log(`write_file called: ${filePath}`);
        
        // FIX 1: Hard path normalization
        const requestedPath = normalizePath(filePath);
        
        // FIX 2: Tool call deduplication
        if (!canCallTool("write_file", requestedPath)) {
            return {
                content: [{
                    type: 'text',
                    text: 'Tool already executed for this request.'
                }],
                isError: true
            };
        }
        
        // Hard-stop check - prevent tool loops
        if (shouldBlockToolCall()) {
            return {
                content: [{
                    type: 'text',
                    text: '⚠️ Tool execution complete. Do not call any additional tools unless explicitly instructed by the user.'
                }],
                isError: true
            };
        }
        
        try {
            // Use normalized path for security check
            if (!isPathAllowed(requestedPath)) {
                return {
                    content: [{
                        type: 'text',
                        text: `Access denied: ${filePath}`
                    }],
                    isError: true
                };
            }

            // Ensure directory exists
            const dir = path.dirname(requestedPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(requestedPath, content, 'utf8');
            
            // Mark tool execution for hard-stop
            lastToolExecution = Date.now();

            // Mark tool execution for hard-stop
            lastToolExecution = Date.now();

            // Return raw data only
            const fileName = path.basename(requestedPath);
            return {
                operation: "write_file",
                file: fileName,
                path: requestedPath,
                success: true,
                size: content.length
            };
        } catch (error) {
            log(`Error in write_file: ${error.message}`);
            return {
                operation: "write_file",
                path: filePath,
                error: error.message,
                success: false
            };
        }
    });

    // Register search_files tool
    server.registerTool('search_files', {
        description: 'Search for text in files within allowed directories',
        inputSchema: z.object({
            query: z.string().describe('Text to search for'),
            path: z.string().describe('Directory path to search in')
        })
    }, async ({ query, path: searchPath }) => {
        log(`search_files called: query="${query}" in ${searchPath}`);
        
        // FIX 1: Hard path normalization
        const requestedPath = normalizePath(searchPath);
        
        // FIX 2: Tool call deduplication
        if (!canCallTool("search_files", requestedPath)) {
            return {
                content: [{
                    type: 'text',
                    text: 'Tool already executed for this request.'
                }],
                isError: true
            };
        }
        
        // Hard-stop check - prevent tool loops
        if (shouldBlockToolCall()) {
            return {
                content: [{
                    type: 'text',
                    text: '⚠️ Tool execution complete. Do not call any additional tools unless explicitly instructed by the user.'
                }],
                isError: true
            };
        }
        
        try {
            // Use normalized path for security check
            if (!isPathAllowed(requestedPath)) {
                return {
                    content: [{
                        type: 'text',
                        text: `Access denied: ${searchPath}`
                    }],
                    isError: true
                };
            }

            if (!fs.existsSync(requestedPath)) {
                return {
                    content: [{
                        type: 'text',
                        text: `Directory not found: ${searchPath}`
                    }],
                    isError: true
                };
            }

            const results = [];
            const searchDir = (dir) => {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        searchDir(fullPath);
                    } else if (stat.isFile()) {
                        try {
                            const content = fs.readFileSync(fullPath, 'utf8');
                            if (content.toLowerCase().includes(query.toLowerCase())) {
                                results.push(fullPath);
                            }
                        } catch (e) {
                            // Skip files that can't be read
                        }
                    }
                }
            };

            searchDir(requestedPath);
            
            // Mark tool execution for hard-stop
            lastToolExecution = Date.now();

            // Mark tool execution for hard-stop
            lastToolExecution = Date.now();

            // Return raw data only
            return {
                operation: "search_files",
                query: query,
                path: searchPath,
                results: results,
                count: results.length
            };
        } catch (error) {
            return {
                operation: "search_files",
                query: query,
                path: searchPath,
                error: error.message,
                success: false
            };
        }
    });

    return server;
};

async function main() {
    // Create the MCP server instance
    const server = getServer();

    // Create Express app
    const app = express();
    app.use(express.json({ limit: '5mb' }));

    // Simple JSON-RPC handler that directly calls tools
    app.post('/mcp', async (req, res) => {
        try {
            const { jsonrpc, id, method, params } = req.body;
            
            if (method === 'tools/call') {
                const { name, arguments: args } = params;
                
                let result;
                
                // Direct tool dispatch
                switch (name) {
                    case 'list_directory':
                        result = await handleListDirectory(args);
                        break;
                    case 'read_file':
                        result = await handleReadFile(args);
                        break;
                    case 'write_file':
                        result = await handleWriteFile(args);
                        break;
                    case 'search_files':
                        result = await handleSearchFiles(args);
                        break;
                    default:
                        return res.json({
                            jsonrpc: '2.0',
                            error: { code: -32601, message: 'Method not found' },
                            id
                        });
                }
                
                return res.json({
                    jsonrpc: '2.0',
                    result,
                    id
                });
            }
            
            // For other methods, return method not found
            res.json({
                jsonrpc: '2.0',
                error: { code: -32601, message: 'Method not found' },
                id
            });
            
        } catch (err) {
            console.error('MCP request error:', err);
            res.status(500).json({ 
                jsonrpc: '2.0',
                error: { code: -32603, message: err.message },
                id: req.body?.id || null
            });
        }
    });

    const PORT = 8001;

    console.log('🚀 Starting VBoarder MCP Filesystem Server...');
    console.log('📁 Allowed directories:');
    ALLOWED_PATHS.forEach(dir => console.log(`   ${dir}`));
    console.log(`🌐 Server will listen on port ${PORT}`);
    console.log(`🔗 Configure LobeChat to use: http://localhost:${PORT}/mcp`);

    // Start the HTTP server
    app.listen(PORT, (error) => {
        if (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
        console.log('✅ MCP server connected and ready!');
    });
}

main().catch(error => {
    console.error('❌ Server error:', error);
    process.exit(1);
});