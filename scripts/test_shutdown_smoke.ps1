<#
Lightweight shutdown smoke test (PowerShell)
Checks:
 - server starts with ENABLE_TEST_ADMIN=1 and MCP_SHUTDOWN_TOKEN
 - /__mcp_shutdown returns 200 and body contains "Shutting down"
 - PID file is removed
 - process is not listening on the port
Exit codes:
 0 => success
 non-zero => failure
#>
param(
    [int]$Port = 8005,
    [string]$ShutdownToken = 'TEST_SHUTDOWN'
)

$ErrorActionPreference = 'Stop'

# Repo-root safety: require runtime dir to exist relative to script
$serverRelative = '..\runtime\triage_20251216_172245\mcp_server.js'
$serverPath = Join-Path -Path $PSScriptRoot -ChildPath $serverRelative | Resolve-Path -ErrorAction SilentlyContinue
if (-not $serverPath) {
    Write-Error "Cannot locate server at $serverRelative (run from repo or move script)."
    exit 2
}
$serverPath = $serverPath.Path

# Environment for test
$env:ENABLE_TEST_ADMIN = '1'
$env:MCP_SHUTDOWN_TOKEN = $ShutdownToken

# Start server in background
Write-Output "Starting server: node $serverPath"
$proc = Start-Process -NoNewWindow -FilePath node -ArgumentList "`"$serverPath`"" -PassThru
Start-Sleep -Seconds 1

# Wait for health
$max = 30
$ready = $false
for ($i=0; $i -lt $max; $i++) {
    try {
        $h = Invoke-RestMethod -Uri "http://localhost:$Port/health" -UseBasicParsing -ErrorAction Stop
        if ($h.status -eq 'ok') { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Write-Error "Server did not become healthy within timeout"
    try { Stop-Process -Id $proc.Id -Force } catch { }
    exit 2
}

# Check PID file presence
$pidFile = Join-Path -Path (Split-Path -Parent $serverPath) -ChildPath 'mcp_server.pid'
if (-not (Test-Path $pidFile)) {
    Write-Error "PID file not present: $pidFile"
    exit 2
}

# Call shutdown endpoint
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:$Port/__mcp_shutdown?token=$ShutdownToken" -Method POST -UseBasicParsing -ErrorAction Stop
} catch {
    Write-Error "Shutdown endpoint failed: $_"
    exit 2
}

if ($resp -notlike '*Shutting down*') {
    Write-Error "Unexpected shutdown response: $resp"
    exit 2
}

# Wait for PID removal
$removed = $false
for ($i=0; $i -lt 10; $i++) {
    if (-not (Test-Path $pidFile)) { $removed = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $removed) {
    Write-Error "PID file still present after shutdown: $pidFile"
    exit 2
}

# Confirm port not listening
Start-Sleep -Seconds 1
$stillListening = (Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet)
if ($stillListening) {
    Write-Error "Port $Port still listening"
    exit 2
}

Write-Output "TEST PASSED: shutdown smoke"
exit 0
