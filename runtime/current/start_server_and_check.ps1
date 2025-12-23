$wd = 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\runtime\current'
Set-Location $wd
$log = Join-Path $wd 'server.log'
if (Test-Path $log) { Remove-Item $log -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath 'node' -ArgumentList 'mcp_server.js' -WorkingDirectory $wd -RedirectStandardOutput $log -RedirectStandardError $log -WindowStyle Hidden
Write-Host 'Server process started, waiting up to 15s for NAVI READY...'

$found = $false
for ($i = 0; $i -lt 30 -and -not $found; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $log) {
        if (Select-String -Path $log -Pattern 'NAVI READY' -SimpleMatch -Quiet) { $found = $true; break }
    }
}

if ($found) {
    Write-Host 'NAVI READY detected in logs.'
    netstat -ano | findstr :8005
} else {
    Write-Host 'NAVI READY not detected within timeout. Last log lines:'
    if (Test-Path $log) { Get-Content $log -Tail 50 } else { Write-Host 'No log file found.' }
}
