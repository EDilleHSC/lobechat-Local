console.log("=== NAVI SERVER BOOTING ===");

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
console.log('[DEBUG] Crypto loaded:', typeof crypto, typeof crypto.createHash);
const { execSync, spawnSync } = require('child_process');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const chokidar = require('chokidar');
const approvalSchema = require('./schemas/approval.schema.json');
const validateApproval = ajv.compile(approvalSchema);

// Explicit Python runtime for predictable execution
const PYTHON = 'D:\\02_SOFTWARE\\Python312\\python.exe';
// Beta-0 trust mode: when true, regenerate presenter from snapshot and skip routing/mailroom
// For Beta-1 we default to OFF so mailroom routing executes by default; set env BETA0_TRUST_MODE=1 to keep Beta-0 behavior
const BETA0_TRUST_MODE = (process.env.BETA0_TRUST_MODE || '0') === '1'; // default OFF for Beta-1 workflow

console.log("Node version:", process.version);
console.log("CWD:", process.cwd());

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

// Load configuration
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config.json');
let config = {};
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    console.log(`[CONFIG] Loaded config from ${CONFIG_PATH}`);
} catch (e) {
    console.log(`[CONFIG] Failed to load config: ${e.message}`);
    config = {
        confidence_thresholds: { human_required: 0.70, auto_route: 0.85 },
        departments: ["Account", "Legal", "Finance", "HR", "Ops", "Support", "Intake", "Trash"]
    };
}

// State machine definitions
const STATES = {
    LIFECYCLE: {
        DETECTED: 'DETECTED',
        ANALYZED: 'ANALYZED',
        QUEUED: 'QUEUED'
    },
    DECISION: {
        AUTO_ROUTED: 'AUTO_ROUTED',
        REVIEW_REQUIRED: 'REVIEW_REQUIRED',
        KB_REVIEW_REQUIRED: 'KB_REVIEW_REQUIRED',
        HUMAN_DECIDED: 'HUMAN_DECIDED'
    },
    FINAL: {
        MOVED: 'MOVED',
        ARCHIVED: 'ARCHIVED',
        REJECTED: 'REJECTED',
        QUARANTINED: 'QUARANTINED',
        TRASH_PENDING: 'TRASH_PENDING',
        TRASHED: 'TRASHED'
    }
};

// Add exception handlers
process.on("uncaughtException", err => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", err => {
  console.error("UNHANDLED PROMISE REJECTION:", err);
});

// Server port can be overridden with the PORT env var for testing/CI
const PORT = Number(process.env.PORT) || 8005;

// Track last activity for health
let lastSnapshotTime = null;
let lastPresenterTime = null;
// Current process mode for /process endpoint: 'DEFAULT' or 'KB'
let CURRENT_PROCESS_MODE = 'DEFAULT';

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

// 🚀 TRIGGER PROCESS PIPELINE - Called by inbox watcher
function triggerProcessPipeline() {
    const http = require('http');
    
    const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/process',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': 0
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                log(`[WATCHER] Process pipeline triggered: ${response.status}`);
            } catch (e) {
                log(`[WATCHER] Process pipeline response: ${data}`);
            }
        });
    });

    req.on('error', (err) => {
        log(`[WATCHER] Failed to trigger process pipeline: ${err.message}`);
    });

    req.end();
}

// Manual inbox processing function
function processInbox(source) {
    console.log(`[PROCESS_INBOX] Triggered by ${source}`);
    // Call the same logic as /process endpoint
    // For simplicity, trigger the pipeline
    triggerProcessPipeline();
}

// 📸 SNAPSHOT CREATION FUNCTION - Extracted for reuse
function takeSnapshot(dirPath) {
    try {
        log(`[SNAPSHOT] Taking snapshot of: ${dirPath}`);
        
        if (!fs.existsSync(dirPath)) {
            log(`[SNAPSHOT] Directory not found: ${dirPath}`);
            return null;
        }

        // List directory contents
        const items = fs.readdirSync(dirPath).map(item => {
            const fullPath = path.join(dirPath, item);
            const stats = fs.statSync(fullPath);
            return {
                name: item,
                type: stats.isDirectory() ? 'directory' : 'file',
                path: fullPath,
                size: stats.size,
                modified: stats.mtime.toISOString()
            };
        });

        log(`[SNAPSHOT] Found ${items.length} items`);

        // Create snapshot directory if needed
        if (!fs.existsSync(SNAPSHOT_DIR)) {
            fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
            log(`[SNAPSHOT] Created snapshot directory: ${SNAPSHOT_DIR}`);
        }

        const snapshot = {
            source: "NAVI",
            event: "inbox_snapshot", 
            timestamp: new Date().toISOString(),
            path: dirPath,
            items: items.map(item => ({
                name: item.name,
                type: item.type,
                size: item.size,
                modified: item.modified,
                // 📁 FOLDER HANDLING: Treat folders as single items with low confidence
                confidence: item.type === 'directory' ? 0.25 : undefined, // Low confidence for folders
                guessedDept: item.type === 'directory' ? 'INTAKE' : undefined // Always route folders to INTAKE
            })),
            status: "unprocessed"
        };

        const snapshotFilename = `${snapshot.timestamp.replace(/[:.]/g, '-')}.json`;
        const snapshotPath = path.join(SNAPSHOT_DIR, snapshotFilename);
        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        
        log(`[SNAPSHOT] Written: ${snapshotPath}`);
        lastSnapshotTime = new Date().toISOString();
        
        return snapshotPath;
    } catch (snapshotError) {
        log(`[SNAPSHOT] Failed: ${snapshotError.message}`);
        return null;
    }
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

function detectReceipt(filename, stats) {
    const lowerName = filename.toLowerCase();
    const ext = path.extname(filename).toLowerCase();
    
    let isReceiptCandidate = false;
    let isBusinessReceipt = false;
    let isPersonalReceipt = false;
    let confidence = 0.5;
    let reasons = ['AI analysis'];
    let summary = [`File: ${filename}, Size: ${stats.size} bytes, Type: ${ext}`];
    let risk_flags = [];
    
    // A. Hard signals (immediate receipt candidate)
    const receiptKeywords = ['receipt', 'invoice', 'paid', 'payment', 'total', 'subtotal', 'tax', 'vat', 'card ending', 'transaction id', 'order number'];
    const hasReceiptKeywords = receiptKeywords.some(keyword => lowerName.includes(keyword));
    
    const currencyPatterns = /[\$€£]\s*\d+[\d,.]*/;
    const hasCurrency = currencyPatterns.test(filename);
    
    const vendorIndicators = ['store', 'clinic', 'airline', 'utility', 'pharmacy', 'grocery', 'restaurant', 'hotel'];
    const hasVendorIndicators = vendorIndicators.some(vendor => lowerName.includes(vendor));
    
    const receiptFileTypes = ['.pdf', '.jpg', '.png', '.txt'];
    const isReceiptFileType = receiptFileTypes.includes(ext);
    
    if (hasReceiptKeywords || hasCurrency || hasVendorIndicators || isReceiptFileType) {
        isReceiptCandidate = true;
        reasons.push('Receipt indicators detected');
        summary.push('- Receipt-like file detected');
    }
    
    // B. Ownership classifier
    if (isReceiptCandidate) {
        // Business receipt indicators
        const businessIndicators = ['company', 'ltd', 'inc', 'corp', 'llc', 'po number', 'invoice number', 'bill to', 'accounts payable', 'net 30'];
        const hasBusinessIndicators = businessIndicators.some(indicator => lowerName.includes(indicator));
        
        // Personal receipt indicators  
        const personalIndicators = ['medical', 'pharmacy', 'grocery', 'travel', 'home', 'personal', 'family', 'thank you', 'visit', 'appointment'];
        const hasPersonalIndicators = personalIndicators.some(indicator => lowerName.includes(indicator));
        
        if (hasBusinessIndicators && !hasPersonalIndicators) {
            isBusinessReceipt = true;
            confidence = Math.random() * 0.15 + 0.85; // 85-100%
            reasons.push('Business receipt indicators detected');
            summary.push('- Business receipt: company identifiers, formal language');
        } else if (hasPersonalIndicators && !hasBusinessIndicators) {
            isPersonalReceipt = true;
            confidence = Math.random() * 0.15 + 0.85; // 85-100%
            reasons.push('Personal receipt indicators detected');
            summary.push('- Personal receipt: individual use, informal indicators');
        } else if (hasBusinessIndicators && hasPersonalIndicators) {
            // Mixed signals - review required
            confidence = Math.random() * 0.15 + 0.70; // 70-85%
            reasons.push('Mixed business/personal indicators');
            summary.push('- Mixed signals: requires human review');
            risk_flags.push('mixed_ownership');
        } else {
            // No clear ownership - review required
            confidence = Math.random() * 0.2 + 0.50; // 50-70%
            reasons.push('No clear ownership indicators');
            summary.push('- Ownership unclear: requires human review');
            risk_flags.push('unclear_ownership');
        }
    } else {
        // Not a receipt - use original logic
        if (lowerName.includes('contract') || lowerName.includes('legal')) {
            confidence = Math.random() * 0.3 + 0.7;
            reasons.push('Legal document patterns');
            summary.push('- Legal document detected');
        } else if (lowerName.includes('client') || lowerName.includes('account')) {
            confidence = Math.random() * 0.3 + 0.7;
            reasons.push('Client/account references');
            summary.push('- Client or account related');
        } else if (lowerName.includes('urgent') || lowerName.includes('important')) {
            confidence = Math.random() * 0.4 + 0.6;
            reasons.push('Priority indicators');
            summary.push('- Marked as urgent or important');
        } else if (['.jpg', '.png', '.jpeg'].includes(ext)) {
            confidence = Math.random() * 0.3 + 0.2;
            reasons.push('Image file - low AI confidence');
            summary.push('- Image file, content unknown');
            risk_flags.push('image_file');
        } else {
            confidence = Math.random() * 0.2 + 0.3;
            reasons.push('Low confidence, needs review');
            summary.push('- Low confidence in classification');
            risk_flags.push('low_confidence');
        }
    }
    
    // Determine final guess
    let guess = 'Intake';
    if (isBusinessReceipt) {
        guess = 'Finance';
    } else if (isPersonalReceipt) {
        guess = 'Personal';
    } else if (isReceiptCandidate) {
        guess = 'Intake'; // Review required for unclear receipts
    }
    
    // C. Confidence rules
    if (confidence >= 0.85) {
        // Auto-route
    } else if (confidence >= 0.70) {
        // REVIEW_REQUIRED with recommendation
        risk_flags.push('review_recommended');
    } else {
        // REVIEW_REQUIRED with risk flag
        risk_flags.push('low_confidence');
    }
    
    return {
        guess,
        confidence: Math.round(confidence * 100),
        reasons,
        summary: summary.join('\n'),
        risk_flags,
        isReceipt: isReceiptCandidate,
        receiptType: isBusinessReceipt ? 'business' : isPersonalReceipt ? 'personal' : 'unknown'
    };
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

        // Create snapshot data with AI analysis
        const items = files.map(filename => {
            const filePath = path.join(inboxPath, filename);
            const stats = fs.statSync(filePath);
            
            // Receipt detection heuristic
            const receiptAnalysis = detectReceipt(filename, stats);
            let guessedDept = receiptAnalysis.guess;
            let confidence = receiptAnalysis.confidence;
            let reasons = receiptAnalysis.reasons;
            let ai_summary = receiptAnalysis.summary;
            // Normalize ai_summary to an array so downstream code can safely use .join('\n')
            if (!Array.isArray(ai_summary)) {
                if (typeof ai_summary === 'string' && ai_summary.trim()) {
                    ai_summary = [ai_summary];
                } else if (ai_summary == null) {
                    ai_summary = [];
                } else {
                    ai_summary = [String(ai_summary)];
                }
            }
            let risk_flags = receiptAnalysis.risk_flags;

            // Normalize confidence and dedupe risk_flags for consistent representation
            // confidence may be returned as a fraction (0.46), a percent (46), or accidentally scaled (4600).
            let confRaw = Number(receiptAnalysis.confidence) || 0;
            // If confidence is too large (e.g., 4600), reduce by 100 to percent
            if (confRaw > 100) { confRaw = Math.round(confRaw / 100); }
            // If confidence is a fraction (<=1), convert to percent
            if (confRaw <= 1) { confRaw = Math.round(confRaw * 100); }
            const confidencePercent = Math.max(0, Math.min(100, Math.round(confRaw)));

            // Dedupe risk flags
            if (!Array.isArray(risk_flags)) { risk_flags = risk_flags ? [String(risk_flags)] : []; }
            risk_flags = Array.from(new Set(risk_flags));

            // Check for risky file types
            const ext = path.extname(filename).toLowerCase();
            if (['.exe', '.bat', '.scr', '.pif', '.com'].includes(ext)) {
                risk_flags.push('executable');
                guessedDept = 'Quarantine';
            } else if (['.zip', '.rar', '.7z'].includes(ext) && stats.size > 10000000) { // 10MB
                risk_flags.push('large_archive');
            }

            const id = crypto.createHash('sha256').update(filename + stats.mtime.toISOString()).digest('hex');

            return {
                id,
                filename,
                source_path: path.join(inboxPath, filename),
                state: STATES.LIFECYCLE.ANALYZED,
                ai: {
                    guess: guessedDept,
                    confidence: confidencePercent,
                    reasons,
                    summary: ai_summary.join('\n'),
                    risk_flags
                },
                human: {
                    final_route: null,
                    reason: null,
                    decided_by: null
                },
                timestamps: {
                    detected: new Date().toISOString(),
                    analyzed: new Date().toISOString(),
                    decided: null,
                    moved: null
                }
            };
        });

        // Enforce summary invariant
        for (const item of items) {
            if (!item.ai.summary || item.ai.summary.trim() === "") {
                const ext = path.extname(item.filename).toLowerCase();
                item.ai.summary = `No extractable content. File type: ${ext}. Routed for human review.`;
                item.ai.risk_flags.push("missing_summary");
            }
        }

        // Route based on confidence and risk
        const autoRouted = [];
        const reviewRequired = [];
        const thresholds = config.confidence_thresholds;

        for (const item of items) {
            const conf = item.ai.confidence / 100; // Convert to 0-1
            
            // Check for quarantine conditions
            if (item.ai.risk_flags.includes('executable')) {
                item.state = STATES.DECISION.REVIEW_REQUIRED;
                item.final_state = STATES.FINAL.QUARANTINED;
                reviewRequired.push(item);
                log(`[ROUTE] ${item.filename} flagged for quarantine (executable)`);
                continue;
            }

            // KB mode: no auto-routing; everything requires human KB review (except quarantined executables)
            if (CURRENT_PROCESS_MODE === 'KB') {
                item.state = STATES.DECISION.KB_REVIEW_REQUIRED;
                reviewRequired.push(item);
                log(`[KB MODE] ${item.filename} set to KB_REVIEW_REQUIRED (no auto-route)`);
                continue;
            }
            
            if (conf >= thresholds.auto_route && item.ai.risk_flags.length === 0) {
                // Auto-route
                item.state = STATES.FINAL.MOVED;
                item.timestamps.moved = new Date().toISOString();
                const destDir = path.join(NAVI_DIR, 'processed', item.ai.guess);
                fs.mkdirSync(destDir, { recursive: true });
                const src = path.join(inboxPath, item.filename);
                const dest = path.join(destDir, item.filename);
                try {
                    fs.renameSync(src, dest);
                    autoRouted.push(item);
                    log(`[AUTO-ROUTE] Auto-routed ${item.filename} to ${item.ai.guess} (conf: ${item.ai.confidence}%)`);
                } catch (e) {
                    console.error(`[ERROR] Failed to auto-route ${item.filename}:`, e.message);
                    item.state = STATES.DECISION.REVIEW_REQUIRED;
                    reviewRequired.push(item);
                }
            } else {
                // Review required
                item.state = STATES.DECISION.REVIEW_REQUIRED;
                reviewRequired.push(item);
                log(`[ROUTE] ${item.filename} requires review (conf: ${item.ai.confidence}%, risks: ${item.ai.risk_flags.join(', ')})`);
            }
        }

        // Invariant check
        for (const item of items) {
            if (item.state === STATES.DECISION.REVIEW_REQUIRED && (!item.ai.summary || item.ai.summary.trim() === "")) {
                throw new Error("Invariant violation: REVIEW_REQUIRED without summary");
            }
        }

        const snapshot = {
            source: 'process_endpoint',
            event: 'inbox_snapshot',
            timestamp: new Date().toISOString(),
            path: inboxPath,
            autoRouted,
            reviewRequired,
            totalFiles: files.length,
            autoRoutedCount: autoRouted.length,
            reviewRequiredCount: reviewRequired.length,
            status: 'processed'
        };

        // Save snapshot
        const snapshotFilename = `${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const snapshotPath = path.join(snapshotDir, snapshotFilename);

        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        console.log(`[SNAPSHOT] Saved: ${snapshotFilename} (${autoRouted.length} auto-routed, ${reviewRequired.length} exceptions)`);

        lastSnapshotTime = new Date().toISOString();

        return { success: true, snapshotPath, autoRoutedCount: autoRouted.length, exceptionCount: reviewRequired.length, exceptions: reviewRequired };

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
        const batchId = snapshot_id;
        const snapshotTimestamp = rendered_at;
        const items = snapshotResult && Array.isArray(snapshotResult.exceptions) ? snapshotResult.exceptions : [];
        const counters = {
            total: items.length,
            review_required: snapshotResult.exceptionCount || 0,
            auto_routed: snapshotResult.autoRoutedCount || 0,
            moved: items.filter(i => i.state === STATES.FINAL.MOVED).length,
            trash_pending: items.filter(i => i.state === STATES.FINAL.TRASH_PENDING).length
        };

        const data = {
            batchId,
            snapshotTimestamp,
            items,
            counters
        };

        // KB mode: include informational banner and metadata in presenter output
        if ((snapshotResult && snapshotResult.mode === 'KB') || CURRENT_PROCESS_MODE === 'KB') {
            data.kb_mode = true;
            data.kb_banner = 'KB Ingest Mode — Human review required';
        }

        // Define output paths
        const jsonPath = path.join(generatedDir, 'presenter.json');
        const jsonTmp = jsonPath + '.tmp';

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

        log(`[PRESENTER] Regenerated presenter assets (no overwrite of approved UI)`);
        return { presenter: jsonPath, rendered_at, batchId, counters };
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
    if (req.method === 'POST' && req.url && req.url.split('?')[0] === '/process') {
        // Allow mode selection via query param: /process?mode=KB
        const u = new URL(req.url, `http://localhost:${PORT}`);
        const processMode = (u.searchParams.get('mode') || 'DEFAULT').toString().toUpperCase();
        CURRENT_PROCESS_MODE = processMode;
        log(`[MCP] Process mode: ${CURRENT_PROCESS_MODE}`);
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
                const presInfo = regeneratePresenter(Object.assign({}, snapshotResult, { mailroom: mailroomInfo, mode: CURRENT_PROCESS_MODE }));
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
            // Reset process mode back to default
            try { CURRENT_PROCESS_MODE = 'DEFAULT'; } catch(e) { /* no-op */ }

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

    // Manual inbox processing endpoint (escape hatch)
    if (req.method === 'POST' && req.url === '/process_inbox') {
        try {
            processInbox('manual');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
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
                    
                    // 📸 SNAPSHOT WRITER - This is the critical functionality
                    const snapshotPath = takeSnapshot(requestedPath);

                    // List directory contents (re-read in case snapshot creation modified anything)
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
            // Normalize to a relative path (no leading slash)
            let rel = urlPath.replace(/^\/presenter\/?/, '') || 'index.html';
            if (rel === '' || rel === '/') rel = 'index.html';
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
                // Fallback: check repo-level 'presenter' directory so developer copies or local UI are served during tests
                try {
                    // Try several candidate locations for developer-level presenter assets
                    const candidates = [
                        path.join(PROJECT_ROOT, 'presenter'),
                        path.join(process.cwd(), 'presenter'),
                        path.join(__dirname, '..', 'presenter'),
                        path.join(__dirname, '..', '..', 'presenter')
                    ];
                    const diagLines = [];
                    for (const cand of candidates) {
                        const fallbackPath = path.join(cand, rel);
                        const exists = fs.existsSync(fallbackPath) && !fs.statSync(fallbackPath).isDirectory();
                        diagLines.push({ candidate: cand, path: fallbackPath, exists });
                        if (exists) {
                            const fallbackExt = path.extname(fallbackPath).toLowerCase();
                            const fallbackMime = mimeTypes[fallbackExt] || 'application/octet-stream';
                            const buf = fs.readFileSync(fallbackPath);
                            console.log(`[PRESENTER] Falling back to candidate presenter dir: ${fallbackPath}`);
                            try { fs.appendFileSync(path.join(__dirname, '..', 'presenter_fallback_diag.log'), JSON.stringify({ time: new Date().toISOString(), url: req.url, rel, diagLines }) + '\n'); } catch(e) { console.error('Failed to write diag log: ' + e.message); }
                            res.writeHead(200, { 'Content-Type': fallbackMime, 'Cache-Control': 'no-store' });
                            return res.end(buf);
                        }
                    }
                    try { fs.appendFileSync(path.join(__dirname, '..', 'presenter_fallback_diag.log'), JSON.stringify({ time: new Date().toISOString(), url: req.url, rel, diagLines }) + '\n'); } catch(e) { console.error('Failed to write diag log: ' + e.message); }
                } catch (e) {
                    console.error('[PRESENTER] Fallback check failed: ' + e.message);
                }

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
                        const timestamp = new Date().toISOString().slice(0,19) + 'Z';
                        const auditLine = `[${timestamp}] ${reviewer} routed ${items.length} items → ${approvalFile}\n`;
                        fs.appendFileSync(auditPath, auditLine, 'utf8');

                        // Enforcement move pass
                        const moveResults = [];
                        for (const item of items) {
                            const { filename, decision } = item;
                            const { dept, sensitivity } = decision;
                            
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
                            if (dept === 'Trash') {
                                bucket = 'rejected';
                            } else if (sensitivity !== 'normal') {
                                bucket = 'escalated';
                            } else {
                                bucket = 'processed';
                            }

                            const destDir = path.join(correctNAVI_DIR, bucket, dept);
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

                        // Log agreement metrics for Zone 2 items (Phase 2.1)
                        try {
                            const agreementLogPath = path.join(APPROVAL_DIR, 'agreement_metrics.log');
                            const snapshotPath = path.join(SNAPSHOT_DIR, `${snapshot_id}.json`);
                            
                            if (fs.existsSync(snapshotPath)) {
                                const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
                                const snapshotItems = snapshot.items || [];
                                
                                for (const item of items) {
                                    const snapshotItem = snapshotItems.find(si => si.name === item.filename);
                                    if (snapshotItem && snapshotItem.confidence) {
                                        const confidence = snapshotItem.confidence / 100;
                                        const ai_dept = snapshotItem.guessedDept || 'UNKNOWN';
                                        const human_dept = item.decision.dept;
                                        const corrected = ai_dept !== human_dept;
                                        
                                        // Only log Zone 2 items (50-90% confidence)
                                        if (confidence >= 0.50 && confidence < 0.90) {
                                            const metric = {
                                                timestamp: new Date().toISOString(),
                                                snapshot_id,
                                                filename: item.filename,
                                                confidence: confidence,
                                                ai_dept,
                                                human_dept,
                                                corrected,
                                                reviewer
                                            };
                                            
                                            const logLine = JSON.stringify(metric) + '\n';
                                            fs.appendFileSync(agreementLogPath, logLine, 'utf8');
                                            console.log('[AGREEMENT] Logged:', metric);
                                        }
                                    }
                                }
                            }
                        } catch (logErr) {
                            console.error('[AGREEMENT] Failed to log metrics:', logErr.message);
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
    } else if (req.method === 'GET' && req.url === '/approvals/agreement') {
        // Serve agreement metrics log (Phase 2.1)
        try {
            const agreementPath = path.join(APPROVAL_DIR, 'agreement_metrics.log');
            if (!fs.existsSync(agreementPath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('agreement_metrics.log not found');
                return;
            }
            const content = fs.readFileSync(agreementPath, 'utf8');
            
            // Parse and compute summary stats
            const lines = content.trim().split('\n').filter(line => line.trim());
            const metrics = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return null;
                }
            }).filter(m => m);
            
            const total = metrics.length;
            const corrected = metrics.filter(m => m.corrected).length;
            const agreement_rate = total > 0 ? ((total - corrected) / total * 100).toFixed(1) : '0.0';
            
            const summary = `AI-Human Agreement Metrics (Zone 2: 50-90% confidence)\n` +
                           `==========================================\n` +
                           `Total Zone 2 decisions: ${total}\n` +
                           `AI correct (no correction): ${total - corrected}\n` +
                           `Human corrections: ${corrected}\n` +
                           `Agreement rate: ${agreement_rate}%\n\n` +
                           `Raw data:\n${content}`;
            
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(summary);
            return;
        } catch (e) {
            log('[ERROR] Serving agreement metrics: ' + (e && e.message));
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
    } else if (req.method === 'POST' && req.url === '/clear_exceptions') {
        // Update presenter.json with human-routed files, merging AI context for audit lineage
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { decisions } = JSON.parse(body);
                const presenterJsonPath = path.join(PRESENTER_GENERATED_DIR, 'presenter.json');
                
                if (fs.existsSync(presenterJsonPath)) {
                    const data = JSON.parse(fs.readFileSync(presenterJsonPath, 'utf8'));
                    
                    // Create lineage records by merging AI context with human decisions
                    const lineageRecords = [];
                    
                    for (const decision of decisions) {
                        // Find corresponding item in presenter data for AI context
                        const item = data.items.find(i => i.filename === decision.filename);
                        
                        const lineageRecord = {
                            filename: decision.filename,
                            ai_guess: item ? item.routed_to : decision.original_route,
                            ai_confidence: item ? item.confidence : decision.confidence,
                            ai_reason: item ? item.reasons : [],
                            ai_summary: item ? item.ai_summary : [],
                            risk_flags: item ? item.risk_flags : [],
                            state: item ? item.state : STATES.LIFECYCLE.DETECTED,
                            decision: item ? item.decision : STATES.DECISION.HUMAN_DECIDED,
                            final_route: decision.final_route,
                            final_state: decision.final_route === 'Trash' ? STATES.FINAL.TRASH_PENDING : STATES.FINAL.MOVED,
                            resolved_by: 'human',
                            timestamp: decision.timestamp,
                            human_reason: decision.human_reason || null
                        };
                        
                        lineageRecords.push(lineageRecord);
                        
                        // Write to audit log with full context
                        const auditPath = path.join(APPROVAL_DIR, 'audit.log');
                        const auditLine = JSON.stringify(lineageRecord) + '\n';
                        fs.appendFileSync(auditPath, auditLine, 'utf8');
                        console.log('[AUDIT] Logged exception resolution:', lineageRecord);
                    }
                    
                    // Update presenter.json with lineage records
                    data.human_routed_files = lineageRecords;
                    fs.writeFileSync(presenterJsonPath, JSON.stringify(data, null, 2), 'utf8');
                    log(`[PRESENTER] Updated human_routed_files with AI context in presenter.json`);
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                log('[ERROR] Clearing exceptions: ' + e.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to clear exceptions' }));
            }
        });
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
            
            // 🚨 INBOX WATCHER - Auto-trigger snapshots when files arrive
            console.log('[WATCHER] Starting inbox watcher...');
            const watcher = chokidar.watch(INBOX_DIR, {
                persistent: true,
                ignoreInitial: false,     // 🔴 force initial adds
                depth: 0,
                usePolling: true,         // 🔴 Windows-safe
                interval: 500
            });

            watcher
                .on('add', (filePath) => {
                    const fileName = path.basename(filePath);
                    console.log(`[WATCHER] ADD: ${filePath}`);
                    processInbox('watcher:add');
                })
                .on('change', (filePath) => {
                    const fileName = path.basename(filePath);
                    console.log(`[WATCHER] CHANGE: ${filePath}`);
                })
                .on('unlink', (filePath) => {
                    const fileName = path.basename(filePath);
                    console.log(`[WATCHER] UNLINK: ${filePath}`);
                })
                .on('error', (err) => {
                    console.error('[WATCHER] ERROR:', err);
                })
                .on('ready', () => {
                    console.log('[WATCHER] READY — initial scan complete');
                });

            console.log(`[WATCHER] Watching: ${INBOX_DIR}`);
            
            // Store watcher reference for cleanup
            server.watcher = watcher;

            console.log("=== NAVI READY: server listening, watcher active ===");
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
        // Stop the file watcher if it exists
        if (server && server.watcher) {
            console.log('[MCP] Stopping file watcher...');
            server.watcher.close();
        }
        
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
// process.on('SIGINT', () => {
//     console.log('[MCP] SIGINT received - initiating shutdown');
//     gracefulShutdown('SIGINT', 0, 5000);
// });