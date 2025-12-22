#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

const LOG_DIR = require('path').join(__dirname, '..', 'logs');
const LOG_FILE = require('path').join(LOG_DIR, 'uvx-shim.log');

try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) {}

const timestamp = new Date().toISOString();
const argv = process.argv.slice(2);
const cwd = process.cwd();
const pid = process.pid;
const ppid = process.ppid;
let parent = null;

const TRACE_FILE = require('path').join(__dirname, '..', 'logs', 'uvx-parent-trace.log');

// Poll for parent process info (best-effort for short-lived parents)
function sleep(ms) {
  // Blocking sleep using Atomics (works in modern Node)
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) { /* fallback no-op */ }
}

function queryParentProcess(ppid) {
  // Detect available methods once
  let hasWmic = false;
  let hasPowershell = false;
  let psListAvailable = false;
  let psList = null;
  try { execSync('where wmic', { stdio: 'ignore' }); hasWmic = true; } catch (e) { }
  try { execSync('where powershell', { stdio: 'ignore' }); hasPowershell = true; } catch (e) { }
  try { psList = require('ps-list'); psListAvailable = true; } catch (e) { psListAvailable = false; }

  try {
    fs.appendFileSync(TRACE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ppid, probe: 'methods_detected', hasWmic, hasPowershell, psListAvailable }) + '\n');
  } catch (e) { /* ignore logging failure */ }

  if (!hasWmic && !hasPowershell && !psListAvailable) {
    // Nothing available to look up parents from inside this environment
    try { fs.appendFileSync(TRACE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ppid, captured: false, reason: 'methods_unavailable', hasWmic, hasPowershell, psListAvailable }) + '\n'); } catch (e) { }
    return null;
  }

  const attempts = 50; // ~5 seconds total at 100ms sleep
  const sleepMs = 100;

  for (let i = 0; i < attempts; i++) {
    // Try Node-native ps-list first if available (non-blocking Promise)
    if (psListAvailable && psList) {
      try {
        const procs = psList.sync ? psList.sync() : null; // some environments may offer sync
        if (procs && Array.isArray(procs)) {
          const p = procs.find(p => p.pid === ppid || p.pid === String(ppid));
          if (p) {
            try { fs.appendFileSync(TRACE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ppid, attempt: i+1, captured: true, method: 'ps-list', info: p }) + '\n'); } catch (e) {}
            return { ProcessId: Number(p.pid), Name: p.name || null, CommandLine: p.cmd || null, ExecutablePath: null };
          }
        }
      } catch (e) {
        // ps-list may be Promise-only or not work; we'll fall back to external tools
        try { fs.appendFileSync(TRACE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ppid, attempt: i+1, method: 'ps-list', captured: false, error: e.message }) + '\n'); } catch (ee) {}
      }
    }

    // If WMIC is present, try it (lightweight)
    if (hasWmic) {
      try {
        const wmicCmd = `wmic process where processid=${ppid} get ProcessId,Name,CommandLine /format:csv`;
        const wmicOut = execSync(wmicCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (wmicOut) {
          const lines = wmicOut.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            const data = lines[lines.length-1].split(',');
            const name = data.length >= 3 ? data[data.length-2] : null;
            const pidField = data[data.length-1];
            const cmdline = data.length >= 2 ? data[1] : null;
            const parsed = { ProcessId: parseInt(pidField, 10) || ppid, Name: name, CommandLine: cmdline, ExecutablePath: null };
            try { fs.appendFileSync(TRACE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ppid, attempt: i+1, captured: true, method: 'wmic', info: parsed }) + '\n'); } catch (e) {}
            return parsed;
          }
        }
      } catch (e) {
        try { fs.appendFileSync(TRACE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ppid, attempt: i+1, method: 'wmic', captured: false, error: e.message }) + '\n'); } catch (ee) {}
      }
    }

    // If PowerShell is present, try CIM
    if (hasPowershell) {
      try {
        const psCmd = `powershell -NoProfile -Command "Try { $p = Get-CimInstance Win32_Process -Filter \"ProcessId=${ppid}\" -ErrorAction Stop; $owner = $p | Invoke-CimMethod -MethodName GetOwner; $out = [PSCustomObject]@{ ProcessId = $p.ProcessId; Name = $p.Name; CommandLine = $p.CommandLine; ExecutablePath = $p.ExecutablePath; ParentProcessId = $p.ParentProcessId; Owner = @{ User = $owner.User; Domain = $owner.Domain } }; $out | ConvertTo-Json -Compress } Catch { Write-Output 'null' }"`;
        const out = execSync(psCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (out && out !== 'null') {
          try { const parsed = JSON.parse(out); fs.appendFileSync(TRACE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ppid, attempt: i+1, captured: true, method: 'cim', info: parsed }) + '\n'); return parsed; } catch (e) { fs.appendFileSync(TRACE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ppid, attempt: i+1, captured: true, method: 'cim', raw: out }) + '\n'); return { raw: out }; }
        }
      } catch (e) {
        try { fs.appendFileSync(TRACE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ppid, attempt: i+1, method: 'cim', captured: false, error: e.message }) + '\n'); } catch (ee) {}
      }
    }

    // wait a bit and retry
    sleep(sleepMs);
  }
  return null;
}

try {
  parent = queryParentProcess(ppid);
  if (parent) { console.log('[uvx-shim] captured parent:', JSON.stringify(parent)); }
} catch (e) {
  // best-effort; ignore
}

const entry = {
  timestamp,
  pid,
  ppid,
  parent,
  cwd,
  args: argv,
  env: {
    UVX_EXIT_CODE: process.env.UVX_EXIT_CODE || null
  }
};

try {
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
} catch (e) {
  // last resort, print to stdout
  console.log('[uvx-shim] failed to write log:', e.message);
}

// Print a small human-friendly message so callers that expect output see something
console.log('uvx shim invoked - args=' + JSON.stringify(argv) + ' cwd=' + cwd);

// Controlled exit code via UVX_EXIT_CODE env var (default 0 - successful containment)
const exitCode = parseInt(process.env.UVX_EXIT_CODE || '0', 10) || 0;
process.exit(exitCode);
