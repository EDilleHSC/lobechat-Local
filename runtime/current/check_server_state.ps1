$wd = 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\runtime\current'
Set-Location $wd
Write-Host 'Checking for node processes...'
Get-Process -Name node -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,StartTime

Write-Host 'Checking for mcp_server.pid file...'
if (Test-Path "$wd\mcp_server.pid") { Write-Host 'mcp_server.pid:'; Get-Content "$wd\mcp_server.pid" } else { Write-Host 'No mcp_server.pid found.' }

Write-Host 'Checking for any .log files in dir:'
Get-ChildItem -Path $wd -Filter *.log -ErrorAction SilentlyContinue | Select-Object Name,Length,LastWriteTime

Write-Host 'Recent files in dir:'
Get-ChildItem -Path $wd -File | Sort-Object LastWriteTime -Descending | Select-Object -First 20 | Format-Table Name,Length,LastWriteTime -AutoSize
