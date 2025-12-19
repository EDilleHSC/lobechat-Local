# Start the MCP server in production mode (PowerShell)
# Usage: set env vars (MCP_APPROVAL_TOKEN, MCP_SHUTDOWN_TOKEN, PORT) then run this script

param()

$ErrorActionPreference = 'Stop'

$port = $env:PORT -ne $null ? $env:PORT : '8005'
$logDir = $env:LOG_DIR -ne $null ? $env:LOG_DIR : "logs"
if (-not (Test-Path -Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$stdoutLog = Join-Path $logDir "mcp_server_$timestamp.log"
$stderrLog = Join-Path $logDir "mcp_server_$timestamp.err.log"
$pidFile = Join-Path $logDir "mcp_server.pid"

# Find server entry
$possible = @("runtime/triage_server/mcp_server.js", "runtime/mcp_server.js", "mcp_server.js")
$server = $possible | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $server) { Write-Error "mcp_server.js not found in expected locations: $($possible -join ', ')"; exit 1 }

Write-Host "Starting MCP server: $server on port $port"

# Start process
$nodeArgs = "$server"
$proc = Start-Process -FilePath node -ArgumentList $nodeArgs -NoNewWindow -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru

# Persist PID
$proc.Id | Out-File -FilePath $pidFile -Encoding ascii
Write-Host "Started (PID: $($proc.Id)). Logs: $stdoutLog (stdout), $stderrLog (stderr)"

# Give it a moment then check health
Start-Sleep -Seconds 2
try {
    $health = Invoke-RestMethod -Uri "http://localhost:$port/health" -Method Get -ErrorAction Stop
    Write-Host "Health: $($health | ConvertTo-Json -Depth 1)"
} catch {
    Write-Warning "Health check failed, check logs: $stdoutLog or $stderrLog"
}

Write-Host "Start script done. Use scripts\stop_prod.ps1 to stop."