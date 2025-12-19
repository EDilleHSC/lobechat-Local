# Stop the MCP server in production mode (PowerShell)
# Usage: set env var PORT and optional MCP_SHUTDOWN_TOKEN, then run this script

param()
$ErrorActionPreference = 'Stop'

$port = $env:PORT -ne $null ? $env:PORT : '8005'
$logDir = $env:LOG_DIR -ne $null ? $env:LOG_DIR : "logs"
$pidFile = Join-Path $logDir "mcp_server.pid"

function KillByPID($p) {
    try { Stop-Process -Id $p -ErrorAction Stop; Write-Host "Killed process $p" } catch { Write-Warning "Failed to kill PID $p: $_" }
}

if (Test-Path $pidFile) {
    $pid = Get-Content $pidFile | Select-Object -First 1
    if ($pid) {
        Write-Host "Found PID: $pid. Attempting graceful shutdown..."
        if ($env:MCP_SHUTDOWN_TOKEN) {
            try {
                Invoke-RestMethod -Uri "http://localhost:$port/shutdown" -Method Post -Headers @{ Authorization = "Bearer $env:MCP_SHUTDOWN_TOKEN" } -ErrorAction Stop
                Write-Host "Shutdown endpoint accepted request. Waiting for process to exit..."
                Start-Sleep -Seconds 3
                if (Get-Process -Id $pid -ErrorAction SilentlyContinue) { KillByPID $pid }
            } catch {
                Write-Warning "Shutdown endpoint failed: $_. Falling back to killing PID."
                KillByPID $pid
            }
        } else {
            Write-Warning "No MCP_SHUTDOWN_TOKEN provided, force killing PID $pid"
            KillByPID $pid
        }
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    } else { Write-Warning "PID file found but empty." }
} else {
    Write-Warning "PID file not found: $pidFile. Trying to find node process listening on port $port..."
    # best-effort: find node process listening - requires netstat parsing
}

Write-Host "Stop script finished."