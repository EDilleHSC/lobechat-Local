param(
    [string]$Override = 'D:\temp_navi_override'
)

$wd = 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\runtime\current'
Set-Location $wd
# Ensure override path exists
if (-not (Test-Path $Override)) { New-Item -ItemType Directory -Path $Override -Force | Out-Null }

# Cleanup old logs
if (Test-Path 'server_out.log') { Remove-Item 'server_out.log' -Force -ErrorAction SilentlyContinue }
if (Test-Path 'server_err.log') { Remove-Item 'server_err.log' -Force -ErrorAction SilentlyContinue }

# Start server with NAVI_ROOT override
$startInfo = Start-Process -FilePath 'node' -ArgumentList 'mcp_server.js' -WorkingDirectory $wd -Environment @{"NAVI_ROOT"=$Override} -RedirectStandardOutput 'server_out.log' -RedirectStandardError 'server_err.log' -PassThru
Write-Host "Started PID $($startInfo.Id) (NAVI_ROOT override: $Override)"
Start-Sleep -Seconds 3

if (Test-Path 'server_out.log') {
    $out = Get-Content 'server_out.log' -Raw -ErrorAction SilentlyContinue
    if ($out -match "\[PATHS\] NAVI_ROOT=(.*)") {
        Write-Host "Server NAVI_ROOT log: $($matches[1])" -ForegroundColor Green
    } else {
        Write-Host "NAVI_ROOT not found in server_out.log" -ForegroundColor Yellow
        Get-Content server_out.log -Tail 50 | ForEach-Object { Write-Host $_ }
    }
} else {
    Write-Host 'no server_out.log yet' -ForegroundColor Red
}

# Kill process to cleanup
try {
    Stop-Process -Id $startInfo.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped PID $($startInfo.Id)"
} catch {
    Write-Host "Failed to stop PID $($startInfo.Id): $_" -ForegroundColor Yellow
}
