Set-Location 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\runtime\current'
if (Test-Path 'server_out.log') { Remove-Item server_out.log -Force -ErrorAction SilentlyContinue }
if (Test-Path 'server_err.log') { Remove-Item server_err.log -Force -ErrorAction SilentlyContinue }
$p = Start-Process node -ArgumentList 'mcp_server.js' -WorkingDirectory (Get-Location) -RedirectStandardOutput server_out.log -RedirectStandardError server_err.log -PassThru
Start-Sleep -Seconds 2
if (Test-Path server_out.log) { Get-Content server_out.log -Tail 200 } else { Write-Host 'no out log' }
Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Write-Host 'Stopped'