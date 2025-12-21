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

try {
  // Try to get parent process info using PowerShell (works on Windows)
  const psCmd = `powershell -NoProfile -Command "Try { $p = Get-Process -Id ${ppid} -ErrorAction Stop | Select-Object -Property Id,ProcessName,Path; $p | ConvertTo-Json -Compress } Catch { Write-Output \"null\" }"`;
  const out = execSync(psCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (out && out !== 'null') {
    try { parent = JSON.parse(out); } catch (e) { parent = { raw: out }; }
  }
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
