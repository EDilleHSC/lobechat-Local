console.log("=== NAVI SERVER BOOTING ===");

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
console.log('[DEBUG] Crypto loaded:', typeof crypto, typeof crypto.createHash);
const { execSync, spawnSync } = require('child_process');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const chokidar = require('chokidar');
const approvalSchema = require('./schemas/approval.schema.json');
const validateApproval = ajv.compile(approvalSchema);
// Batch logging helper (write per-batch JSON for auditing)
const { logBatch, writeBatchLogSafe } = require('./lib/batch_log');
// Applier utility to atomically move files and create packages for offices
const { applyRoute } = require('./lib/applier');
// AI classifier (local model wrapper)
const { classifyWithAI } = require('../../src/ai/classifier');

// Explicit Python runtime for predictable execution
const PYTHON = 'D:\\02_SOFTWARE\\Python312\\python.exe';
// Beta-0 trust mode: when true, regenerate presenter from snapshot and skip routing/mailroom
// For Beta-1 we default to OFF so mailroom routing executes by default; set env BETA0_TRUST_MODE=1 to keep Beta-0 behavior
let BETA0_TRUST_MODE = (process.env.BETA0_TRUST_MODE || '0') === '1'; // default OFF for Beta-1 workflow (mutable for admin/test)

console.log("Node version:", process.version);
console.log("CWD:", process.cwd());

// Configuration
// NAVI_ROOT and related NAVI paths will be initialized AFTER configuration is loaded.
// (See below where we set NAVI_ROOT using config.navi_root or process.env.NAVI_ROOT.)
// Placeholder variables declared here so references don't error before initialization
let NAVI_ROOT;
let INBOX_DIR;
let SNAPSHOT_DIR;
let APPROVAL_DIR;

// NAVI_ROOT will be logged after config loading.
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

// Try loading NAVI-specific config to pick up routing and path overrides
const NAVI_CONFIG_PATH = path.join(PROJECT_ROOT, 'NAVI', 'config', 'routing_config.json');
try {
    const ncfg = JSON.parse(fs.readFileSync(NAVI_CONFIG_PATH, 'utf8'));
    Object.assign(config, ncfg);
    console.log(`[CONFIG] Loaded NAVI config from ${NAVI_CONFIG_PATH}`);
} catch (e) {
    // Not fatal; continue with main config
}

// Initialize NAVI paths now that config and PROJECT_ROOT are available
if (config.use_navi_root === false) {
    NAVI_ROOT = path.join(PROJECT_ROOT, 'NAVI');
    log('[CONFIG] use_navi_root is false; using PROJECT_ROOT/NAVI');
} else {
    NAVI_ROOT = process.env.NAVI_ROOT || config.navi_root || path.join(PROJECT_ROOT, 'NAVI');
}
INBOX_DIR = path.join(NAVI_ROOT, 'inbox');
SNAPSHOT_DIR = path.join(NAVI_ROOT, 'snapshots', 'inbox');
// Approvals directory for persistent approval objects and audit log
APPROVAL_DIR = path.join(NAVI_ROOT, 'approvals');

console.log(`[PATHS] NAVI_ROOT=${NAVI_ROOT}`);
console.log(`[PATHS] INBOX_DIR=${INBOX_DIR}`);
console.log(`[PATHS] SNAPSHOT_DIR=${SNAPSHOT_DIR}`);
console.log(`[PATHS] APPROVAL_DIR=${APPROVAL_DIR}`);

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
// Last observed (files-only) inbox state (string of filenames) to deduplicate watcher triggers
let lastInboxState = null;
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
console.log('[ENV] MCP_APPROVAL_TOKEN:', process.env.MCP_APPROVAL_TOKEN ? 'SET' : 'NOT_SET');

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

    // Guard 1: If an ingest lock exists, skip and explain why
    const lockPath = path.join(NAVI_DIR, '.ingest.lock');
    if (fs.existsSync(lockPath)) {
        log('[WATCHER] Ingest lock present — skipping auto-trigger');
        return;
    }

    // Guard 2: Deduplicate repeated events by file-list snapshot (files only)
    let files = [];
    try {
        files = fs.readdirSync(INBOX_DIR).filter(f => fs.statSync(path.join(INBOX_DIR, f)).isFile()).sort();
    } catch (e) {
        log('[WATCHER] Failed to read inbox for change-detection: ' + e.message);
    }
    const state = files.join('|');
    if (lastInboxState && lastInboxState === state) {
        log(`[WATCHER] No meaningful inbox change — skipping auto-trigger (${files.length} files)`);
        return;
    }

    // Record the state and proceed
    lastInboxState = state;

    // Call the same logic as /process endpoint
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

        // Update lastInboxState snapshot marker (files only)
        try {
            const fileNames = items.filter(i => i.type === 'file').map(i => i.name).sort();
            lastInboxState = fileNames.join('|');
        } catch (e) {
            // best-effort; non-fatal
        }

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
const pidFile = process.env.MCP_PID_FILE || path.join(__dirname, 'mcp_server.pid');
if (process.env.MCP_PID_FILE) console.log('[MCP] Using custom MCP_PID_FILE:', process.env.MCP_PID_FILE);
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

// Text extraction helper (Phase 1): only supports .txt and .md.
// Returns first N bytes (snippet) or null if not extractable yet.
function extractText(filePath, maxBytes = 4096) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const ext = path.extname(filePath).toLowerCase();
        if (!['.txt', '.md'].includes(ext)) {
            // TODO: integrate OCR pipeline for PDFs and images (DeepSeek, PaddleOCR, tesseract, etc.)
            return null;
        }
        const stats = fs.statSync(filePath);
        const readBytes = Math.min(maxBytes, Math.max(0, stats.size));
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(Math.min(readBytes, maxBytes));
        fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        let text = buf.toString('utf8').replace(/\r\n/g, '\n').trim();
        // Truncate to ensure snippet is not too large
        if (text.length > maxBytes) text = text.slice(0, maxBytes);
        return text;
    } catch (e) {
        log(`[EXTRACT] Failed to extract text from ${filePath}: ${e.message}`);
        return null;
    }
}

// Very small heuristic entity detector using text snippet (Phase 1).
// Returns { entity: string|null, confidence: 0-100 }
function detectEntityFromText(text) {
    if (!text || typeof text !== 'string') return { entity: null, confidence: 0 };
    const lc = text.toLowerCase();

    // Quick special-case mappings for high-confidence phrases
    if (lc.includes('home stagers') || lc.includes('home stagers choice')) {
        return { entity: 'HSC', confidence: 95 };
    }

    const entityKeywords = {
        'HSC': ['hsc', 'schoolhouse', 'school house', 'home stagers'],
        'LHI': ['lhi', 'loric homes', 'loric'],
        'LTD': ['ltd', 'limited', 'ltd.'],
        'DDM': ['ddm'],
        'VB': ['vb', 'vboarder', 'vboarder'],
        'DESK': ['desk', 'helpdesk', 'service desk'],
        'LEGAL': ['legal', 'contract', 'attorney', 'law'],
        'FINANCE': ['invoice', 'receipt', 'payment', 'accounts payable', 'finance']
    };
    let found = null;
    let score = 0;
    for (const [entity, keywords] of Object.entries(entityKeywords)) {
        for (const kw of keywords) {
            if (lc.includes(kw)) {
                found = entity;
                score += 25; // each match adds 25
            }
        }
    }
    // cap confidence
    const confidence = Math.max(0, Math.min(100, Math.round(Math.min(score, 100))));
    return { entity: found, confidence };
}

async function takeSnapshot() {
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

            // Extract text snippet for text-like files (Phase 1)
            let extracted_text_snippet = null;
            let detected_entity = null;
            let detected_entity_confidence = 0;
            try {
                extracted_text_snippet = extractText(filePath, 4096);
                if (extracted_text_snippet) {
                    const ent = detectEntityFromText(extracted_text_snippet);
                    if (ent) {
                        detected_entity = ent.entity;
                        detected_entity_confidence = ent.confidence;
                    }
                }
            } catch (e) {
                log(`[EXTRACT] Error processing text/entity detection for ${filePath}: ${e.message}`);
            }

            // Check for risky file types
            const ext = path.extname(filename).toLowerCase();
            if (['.exe', '.bat', '.scr', '.pif', '.com'].includes(ext)) {
                risk_flags.push('executable');
                guessedDept = 'Quarantine';
            } else if (['.zip', '.rar', '.7z'].includes(ext) && stats.size > 10000000) { // 10MB
                risk_flags.push('large_archive');
            }

            const id = crypto.createHash('sha256').update(filename + stats.mtime.toISOString()).digest('hex');

            // Check for sidecar (.navi.json) and attach if present
            const sidecarPath = path.join(inboxPath, `${filename}.navi.json`);
            let sidecar = null;
            if (fs.existsSync(sidecarPath)) {
                try {
                    sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
                } catch (e) {
                    log(`[SIDECAR] Failed to read sidecar for ${filename}: ${e.message}`);
                }
            }

            return {
                id,
                filename,
                source_path: path.join(inboxPath, filename),
                sidecarPath: sidecarPath,
                sidecar: sidecar,
                state: STATES.LIFECYCLE.ANALYZED,
                ai: {
                    guess: guessedDept,
                    confidence: confidencePercent,
                    reasons,
                    summary: ai_summary.join('\n'),
                    risk_flags,
                    // Phase 1 extracted text and simple entity detection
                    extracted_text_snippet: extracted_text_snippet,
                    entity: detected_entity,
                    entity_confidence: detected_entity_confidence
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

        // AI-first classification (prototype): call local model for each item and attach classification to item.ai.ai_classification
        for (const item of items) {
            try {
                const aiRes = await classifyWithAI(item.filename, item.ai.extracted_text_snippet);
                if (!aiRes) {
                    // Model down or returned nothing
                    item.ai.ai_classification = { error: 'model_unavailable' };
                } else {
                    item.ai.ai_classification = aiRes;
                }
            } catch (e) {
                log(`[AI] classification error for ${item.filename}: ${e.message}`);
                item.ai.ai_classification = { error: 'model_error', message: e.message };
            }
        }

        // Route based on confidence and risk
        const autoRouted = [];
        const reviewRequired = [];
        const thresholds = config.confidence_thresholds;

        // Ensure sidecar metadata is persisted for every routed file so snapshots, packages and audits
        // contain a stable, queryable record of routing decisions and AI signals.
        function writeSidecarForItem(item, route, routingMeta) {
            try {
                const scPath = item.sidecarPath;
                const sc = item.sidecar || { navi: { suggested_filename: item.filename }, routing: {} };
                sc.routing = sc.routing || {};
                sc.routing.destination = route;
                sc.routing.confidence = Number(item.ai.confidence || item.ai.entity_confidence || 0);
                sc.routing.reasons = item.ai.reasons || [];
                // Reflect whether this is an auto-route decision (helps downstream auditing and presenter flags)
                sc.routing.autoRoute = (item.ai && item.ai.action === 'auto_routed');
                if (routingMeta && routingMeta.snapshot_id) sc.routing.snapshot_id = routingMeta.snapshot_id;
                sc.routing.applied_at = new Date().toISOString();
                // Include AI classification (if present) so sidecars capture model reasoning
                sc.ai_classification = (item.ai && item.ai.ai_classification) ? item.ai.ai_classification : (sc.ai_classification || null);
                try {
                    fs.writeFileSync(scPath + '.tmp', JSON.stringify(sc, null, 2), 'utf8');
                    fs.renameSync(scPath + '.tmp', scPath);
                } catch (e) {
                    // best-effort: log but do not fail routing
                    log(`[SIDECAR] Warning: failed to persist sidecar for ${item.filename} at ${scPath}: ${e.message}`);
                }
                item.sidecar = sc;
            } catch (e) {
                log(`[SIDECAR] Failed to compose sidecar for ${item.filename}: ${e.message}`);
            }
        }

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
            
            // Determine which office (entity) this box belongs to
            let office = item.ai.entity || 'DESK';
            let entityConf = Number(item.ai.entity_confidence || 0);

            // AI suggestion override (prototype): if the model suggests a department and we don't already
            // have a strong entity confidence, let AI suggest the office. Rules (e.g., insurance heuristic)
            // will still take precedence later.
            if (item.ai && item.ai.ai_classification && item.ai.ai_classification.department) {
                const suggested = String(item.ai.ai_classification.department);
                if (!entityConf || entityConf < 85) {
                    office = suggested;
                    item.ai.reasons = Array.from(new Set((item.ai.reasons || []).concat([`ai_suggestion:${suggested}`])));
                }
            }

            // Delivery rule: High entity confidence (>=85%) allows auto-delivery unless there are real risk flags.
            // We allow a high-confidence entity to override 'unclear_ownership' and 'low_confidence' but not strong risk flags like 'executable'.
            const effectiveRiskFlags = item.ai.risk_flags.filter(f => !( (f === 'unclear_ownership' || f === 'low_confidence') && entityConf >= 85));
            // Record effective risk flags for audit
            item.ai.effective_risk_flags = effectiveRiskFlags;
            log(`[DELIVERY CHECK] ${item.filename}: entity=${office}, entityConf=${entityConf}%, original_risks=${item.ai.risk_flags.join(', ')}, effective_risks=${effectiveRiskFlags.join(', ')}`);

            // Respect sidecar routing overrides (if present) and allow them to force delivery when confidence high
            const forcedBySidecar = item.sidecar && item.sidecar.routing && item.sidecar.routing.destination && (Number(item.sidecar.routing.confidence || 0) >= 85);
            if (forcedBySidecar) {
                // Apply sidecar overrides
                office = item.sidecar.routing.destination;
                entityConf = Number(item.sidecar.routing.confidence || 0);
                item.ai.entity = office;
                item.ai.entity_confidence = entityConf;
            }

            if ((entityConf >= 85 && effectiveRiskFlags.length === 0) || forcedBySidecar) {
                // Use applier to perform canonical delivery into offices and packages (async)
                const src = item.source_path || path.join(inboxPath, item.filename);
                try {
                    const route = item.sidecar && item.sidecar.routing && item.sidecar.routing.destination ? item.sidecar.routing.destination : office;
                    const routingMeta = { snapshot_id: new Date().toISOString().replace(/[:.]/g, '-') };
                    // Persist sidecar before applying route so applier can move it and package can be updated
                    writeSidecarForItem(item, route, routingMeta);
                    const result = await applyRoute({ srcPath: src, sidecarPath: item.sidecarPath, route, routingMeta, config });

                    // Mark moved
                    item.state = STATES.FINAL.MOVED;
                    item.final_state = STATES.FINAL.MOVED;
                    item.timestamps.moved = new Date().toISOString();
                    item.ai.routing_note = `Auto-delivered to ${route} via applier (entity confidence: ${entityConf}%)`;
                    item.ai.action = 'auto_routed';
                    item.ai.destination = result.package ? result.delivered_to || result.packagePath : (result.destPath || null);
                    autoRouted.push(item);
                    log(`[DELIVERY] ${item.filename} → ${route} via applier`);
                } catch (err) {
                    console.error(`[DELIVERY ERROR] Failed to apply route for ${item.filename}:`, err.message);
                    item.state = STATES.DECISION.REVIEW_REQUIRED;
                    item.ai.routing_note = `Move failed: ${err.message}`;
                    item.ai.action = 'move_failed';
                    item.ai.destination = null;
                    reviewRequired.push(item);
                }
            } else {
                // Decision: where review is required we should still move files out of NAVI/inbox to the inferred office
                // when an office/entity can be determined (e.g., FINANCE) unless the file is quarantined (executable) or KB mode.
                const canMoveToOffice = office && office !== 'DESK' && !item.ai.risk_flags.includes('executable') && CURRENT_PROCESS_MODE !== 'KB';

                // Insurance filename/text heuristic: when filename or extracted text strongly indicates insurance, move to CFO even if entity is DESK
                const fileLower = (item.filename || '').toLowerCase();
                const txtLower = (item.extractedText || '').toLowerCase();
                const insuranceKeywords = [
                  'insurance', 'ins', 'ins.', 'policy', 'premium', 'coverage', 'claim', 'deductible',
                  'progressive', 'progresive', 'statefarm', 'state farm', 'geico', 'allstate',
                  'nationwide', 'liberty mutual', 'usaa', 'auto insurance', 'home insurance', 'liability'
                ];
                const insuranceHeuristic = insuranceKeywords.some(k => fileLower.includes(k) || txtLower.includes(k));

                if (canMoveToOffice) {
                    const src = item.source_path || path.join(inboxPath, item.filename);
                    try {
                        const route = office;
                        const routingMeta = { snapshot_id: new Date().toISOString().replace(/[:.]/g, '-') };
                        // Persist sidecar before applying route so applier can move it and package can be updated
                        writeSidecarForItem(item, route, routingMeta);
                        const result = await applyRoute({ srcPath: src, sidecarPath: item.sidecarPath, route, routingMeta, config });

                        // Mark moved but keep review_required semantics
                        item.state = STATES.FINAL.MOVED;
                        item.final_state = STATES.FINAL.MOVED;
                        item.timestamps.moved = new Date().toISOString();
                        item.ai.routing_note = `Moved to ${route} for manual review (entityConf: ${entityConf}%)`;
                        item.ai.action = 'review_required';
                        item.ai.destination = result.package ? result.delivered_to || result.packagePath : (result.destPath || null);
                        item.review_required = true;
                        autoRouted.push(item);
                        log(`[MOVE_FOR_REVIEW] ${item.filename} → ${route} (review required)`);
                    } catch (err) {
                        console.error(`[DELIVERY ERROR] Failed to move-for-review ${item.filename}:`, err.message);
                        item.state = STATES.DECISION.REVIEW_REQUIRED;
                        item.ai.routing_note = `Move failed: ${err.message}`;
                        item.ai.action = 'move_failed';
                        item.ai.destination = null;
                        reviewRequired.push(item);
                    }
                } else if (!canMoveToOffice && insuranceHeuristic && !item.ai.risk_flags.includes('executable')) {
                    // Apply insurance heuristic to move DESK insurance-like files to CFO and auto-route (per routing policy)
                    const src = item.source_path || path.join(inboxPath, item.filename);
                    try {
                        const route = 'CFO';
                        const routingMeta = { snapshot_id: new Date().toISOString().replace(/[:.]/g, '-') };
                    // Mark as auto-routed to align with router override (confidence high)
                    item.ai.action = 'auto_routed';
                    item.ai.confidence = 90;
                    if (!Array.isArray(item.ai.reasons)) item.ai.reasons = [];
                    item.ai.reasons = Array.from(new Set(item.ai.reasons.concat(['insurance_override'])));
                    // Persist sidecar before applying route so applier can move it and package can be updated
                    writeSidecarForItem(item, route, routingMeta);
                    const result = await applyRoute({ srcPath: src, sidecarPath: item.sidecarPath, route, routingMeta, config });
                        item.state = STATES.FINAL.MOVED;
                        item.final_state = STATES.FINAL.MOVED;
                        item.timestamps.moved = new Date().toISOString();
                        item.ai.routing_note = `Insurance heuristic: auto-routed to ${route}`;
                        // Mark as auto-routed to align with router override (confidence high)
                        item.ai.action = 'auto_routed';
                        item.ai.confidence = 90;
                        if (!Array.isArray(item.ai.reasons)) item.ai.reasons = [];
                        item.ai.reasons = Array.from(new Set(item.ai.reasons.concat(['insurance_override'])));
                        item.ai.destination = result.package ? result.delivered_to || result.packagePath : (result.destPath || null);
                        // Ensure review_required flag is not set for auto-routed items
                        item.review_required = false;
                        autoRouted.push(item);
                        log(`[INSURANCE] ${item.filename} → ${route} via heuristic (auto-routed)`);
                    } catch (err) {
                        console.error(`[DELIVERY ERROR] Failed to move insurance ${item.filename}:`, err.message);
                        item.state = STATES.DECISION.REVIEW_REQUIRED;
                        item.ai.routing_note = `Move failed: ${err.message}`;
                        item.ai.action = 'move_failed';
                        item.ai.destination = null;
                        reviewRequired.push(item);
                    }
                } else {
                    // Leave on loading dock for human review
                    item.state = STATES.DECISION.REVIEW_REQUIRED;
                    item.ai.action = 'review_required';
                    item.ai.destination = null;
                    if (entityConf >= 85) {
                        item.ai.routing_note = `High entity confidence (${entityConf}%) but risk flags present: ${item.ai.risk_flags.join(', ')}; holding for manual review.`;
                    } else {
                        item.ai.routing_note = `Low entity confidence (${entityConf}%) or risk flags present; holding for manual review.`;
                    }
                    reviewRequired.push(item);
                    log(`[HOLD] ${item.filename} needs review (entity: ${office}, conf: ${entityConf}%, risk_flags: ${item.ai.risk_flags.join(', ')}, effective_risks: ${effectiveRiskFlags.join(', ')})`);
                }
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

        // Compute batch stats for audit
        const batchStats = {
            files_processed: snapshot.totalFiles,
            auto_routed: {},
            review_required: snapshot.reviewRequiredCount || 0,
            errors: 0,
            duration_ms: Date.now() - (typeof batchStart === 'number' ? batchStart : Date.now()),
            details: []
        };

        for (const it of snapshot.autoRouted.concat(snapshot.reviewRequired)) {
            const entity = (it.ai && it.ai.entity) ? it.ai.entity : 'DESK';
            const action = it.ai && it.ai.action ? it.ai.action : (it.state === STATES.FINAL.MOVED ? 'auto_routed' : 'review_required');
            if (action === 'auto_routed') {
                batchStats.auto_routed[entity] = (batchStats.auto_routed[entity] || 0) + 1;
            }
            if (action === 'move_failed') batchStats.errors += 1;

            batchStats.details.push({
                filename: it.filename,
                entity: it.ai ? it.ai.entity : null,
                entity_confidence: it.ai ? it.ai.entity_confidence : 0,
                risk_flags: it.ai ? it.ai.risk_flags : [],
                effective_risk_flags: it.ai ? it.ai.effective_risk_flags : [],
                action: action,
                destination: it.ai ? it.ai.destination : null
            });
        }

        // Write the batch log (attempt but do not block snapshot creation)
        (async () => {
            try {
                const batchLogPath = await writeBatchLogSafe(batchStats, { timeout: 5000 });
                snapshot.batch_log = batchLogPath;
            } catch (e) {
                log('[BATCH LOG] Failed to write batch log: ' + e.message);
                // Fallback: write emergency audit record (best-effort, synchronous)
                try {
                    const auditDir = path.join(APPROVAL_DIR || NAVI_ROOT, 'audit');
                    fs.mkdirSync(auditDir, { recursive: true });
                    const auditPath = path.join(auditDir, `batch_log_error_${Date.now()}.json`);
                    fs.writeFileSync(auditPath, JSON.stringify({ error: e.message, batch: batchStats, timestamp: new Date().toISOString() }, null, 2));
                } catch (er) {
                    log('[BATCH LOG] Emergency audit write failed: ' + er.message);
                }
            }
        })();

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
        // Allow canonical presenter dir to be configured (fallback to NAVI_ROOT/presenter)
        const CANONICAL_PRESENTER_DIR = config.canonical_presenter_dir || path.join(NAVI_ROOT, 'presenter');
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
const server = http.createServer(async (req, res) => {
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
            const snapshotResult = await takeSnapshot();
            console.log('[SNAPSHOT] Snapshot taken:', snapshotResult);

            // 2. Regenerate presenter from snapshot immediately (Beta-0 trust mode)
            // 2. Run mailroom (snapshot already taken)
            // In Beta-1 we run mailroom by default; BETA0_TRUST_MODE=true will skip mailroom and keep Beta-0 behaviour.
            let mailroomInfo = null;
            if (BETA0_TRUST_MODE) {
                // In Beta-0 trust mode we **do not** run mailroom routing — we only validate regeneration
                log('[BETA0] Trust mode active: skipping mailroom routing');

                // Ensure we do not leave KB mode set when returning early
                try { CURRENT_PROCESS_MODE = 'DEFAULT'; log('[BETA0] Reset CURRENT_PROCESS_MODE to DEFAULT before early return'); } catch(e) {}

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    message: 'Snapshot taken and presenter regenerated (Beta-0 trust mode, routing skipped). Mode reset to DEFAULT.',
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
    } else if (req.method === 'GET' && req.url && req.url.split('?')[0] === '/batch_summary') {
        try {
            const summary = generateBatchSummary();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(summary));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
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

    // TEST ADMIN: allow toggling BETA0 and debug querying when ENABLE_TEST_ADMIN=1 and correct token supplied
    } else if (process.env.ENABLE_TEST_ADMIN === '1' && req.url && req.url.indexOf('/__mcp_set_beta0') === 0) {
        try {
            const u = new URL(req.url, `http://localhost:${PORT}`);
            const token = u.searchParams.get('token') || '';
            const expected = process.env.MCP_SHUTDOWN_TOKEN || 'TEST_SHUTDOWN';
            if (token !== expected) { res.writeHead(403); res.end('Forbidden'); return; }
            const value = (u.searchParams.get('value') || '0').toString();
            BETA0_TRUST_MODE = (value === '1' || value.toLowerCase() === 'true');
            log(`[TEST_ADMIN] Set BETA0_TRUST_MODE=${BETA0_TRUST_MODE}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, BETA0_TRUST_MODE }));
            return;
        } catch (e) {
            res.writeHead(400); res.end('Bad Request');
            return;
        }
    } else if (process.env.ENABLE_TEST_ADMIN === '1' && req.url && req.url.indexOf('/__mcp_debug') === 0) {
        try {
            const u = new URL(req.url, `http://localhost:${PORT}`);
            const token = u.searchParams.get('token') || '';
            const expected = process.env.MCP_SHUTDOWN_TOKEN || 'TEST_SHUTDOWN';
            if (token !== expected) { res.writeHead(403); res.end('Forbidden'); return; }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ CURRENT_PROCESS_MODE, BETA0_TRUST_MODE }));
            return;
        } catch (e) {
            res.writeHead(400); res.end('Bad Request');
            return;
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
        server.listen(PORT, '127.0.0.1', () => {
            console.log('[BIND] server.address():', JSON.stringify(server.address()));
            console.log('[BIND] server.listening:', server.listening);

            // Self-connect checks for both IPv4 and IPv6 loopback to confirm bind
            const tryConnect = (host) => {
                const s = new net.Socket();
                s.setTimeout(1000);
                s.on('error', (e) => console.log(`[BIND] connect ${host} error:`, e && e.message));
                s.on('timeout', () => { console.log(`[BIND] connect ${host} timeout`); s.destroy(); });
                s.connect({ port: PORT, host }, () => { console.log(`[BIND] connect ${host} success`); s.destroy(); });
            };

            tryConnect('127.0.0.1');
            tryConnect('::1');

            console.log('[MCP] Server connected and ready');

            // Optional HTTP health shim to accommodate CI/HTTP health checks for MCP (disabled by default)
            if ((process.env.MCP_HTTP_HEALTH || 'false') === 'true') {
                try {
                    const http = require('http');
                    const healthPort = parseInt(process.env.MCP_HTTP_HEALTH_PORT, 10) || (PORT + 1);
                    const healthServer = http.createServer((req, res) => {
                        if (req.method === 'GET' && req.url === '/health') {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ ok: true, pid: process.pid, uptime: process.uptime(), timestamp: new Date().toISOString() }));
                        } else {
                            res.writeHead(404); res.end();
                        }
                    });
                    healthServer.listen(healthPort, '127.0.0.1', () => {
                        console.log(`[MCP] HTTP health shim listening on http://127.0.0.1:${healthPort}/health`);
                    });
                    server.healthServer = healthServer;
                } catch (e) {
                    console.warn('[MCP] Failed to start HTTP health shim:', e && e.message);
                }
            }

            // 🚨 INBOX WATCHER - Auto-trigger snapshots when files arrive
            // Disable the watcher in CI/tests to avoid initial-scan churn that can block the event loop
            if (process.env.CI === 'true' || process.env.NODE_ENV === 'test' || process.env.DISABLE_WATCHER === '1') {
                console.log('[WATCHER] Disabled in test/CI environment');
                console.log("=== NAVI READY: server listening, watcher disabled ===");
            } else {
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
                        const ingestLock = path.join(NAVI_DIR, '.ingest.lock');
                        if (fs.existsSync(ingestLock)) {
                            log('[WATCHER] Ingest lock present — skipping auto-trigger');
                            return;
                        }
                        log(`[WATCHER] ADD: ${filePath}`);
                        processInbox('watcher:add');
                    })
                    .on('change', (filePath) => {
                        const ingestLock = path.join(NAVI_DIR, '.ingest.lock');
                        if (fs.existsSync(ingestLock)) {
                            log('[WATCHER] Ingest lock present — skipping change-trigger');
                            return;
                        }
                        const fileName = path.basename(filePath);
                        log(`[WATCHER] CHANGE: ${filePath}`);
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
            }
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

        // Close optional HTTP health shim if present
        if (server && server.healthServer) {
            try {
                console.log('[MCP] Closing HTTP health shim...');
                server.healthServer.close();
            } catch (e) { /* best-effort */ }
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