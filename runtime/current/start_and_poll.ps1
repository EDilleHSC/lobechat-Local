$wd = 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\runtime\current'
Set-Location $wd
$pidFile = Join-Path $wd 'mcp_server.pid'
if (Test-Path $pidFile) {
    try {
        $old = (Get-Content $pidFile).Trim()
        if ($old -match '^\d+$') { Stop-Process -Id [int]$old -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 500 }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    } catch { }
}
$log = Join-Path $wd 'server.log'
if (Test-Path $log) { Remove-Item $log -Force -ErrorAction SilentlyContinue }
Start-Process -FilePath 'node' -ArgumentList 'mcp_server.js' -WorkingDirectory $wd -RedirectStandardOutput $log -RedirectStandardError $log -WindowStyle Hidden -PassThru | Out-Null
Write-Host 'Server started, waiting up to 10s for [BIND] or NAVI READY lines in server.log...'
$found = $false
for ($i = 0; $i -lt 20 -and -not $found; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $log) {
        $tail = Get-Content $log -Tail 200 -ErrorAction SilentlyContinue -Raw
        if ($tail -match '\[BIND\]' -or $tail -match 'NAVI READY') {
            Write-Host '--- server.log matches ---'
            $tail -split "`n" | Select-String -Pattern '\[BIND\]|NAVI READY' -AllMatches | ForEach-Object { Write-Host $_.Line }
            $found = $true
            break
        }
    }
}
if (-not $found) {
    Write-Host 'No diagnostic lines found in server.log within timeout. Showing last 200 lines if present:'
    if (Test-Path $log) { Get-Content $log -Tail 200 } else { Write-Host 'No server.log found' }
}
Write-Host '--- netstat :8005 ---'
netstat -ano | findstr :8005
Write-Host '--- curl health ---'
try { curl -v http://127.0.0.1:8005/health } catch { Write-Host 'curl failed' }