Write-Host "🛑 Stopping VBoarder Server..." -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "🛡️ Attempting to open Firewall Port 8000..." -ForegroundColor Yellow
try {
    Start-Process netsh -ArgumentList "advfirewall firewall add rule name=`"Allow VBoarder 8000`" dir=in action=allow protocol=TCP localport=8000" -Verb RunAs -Wait
    Write-Host "✅ Firewall rule added (if you approved)." -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not add firewall rule. You might need to do it manually." -ForegroundColor Red
}

Write-Host "🚀 Starting VBoarder Server..." -ForegroundColor Green
$pyScript = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\mcp_server.py"
Start-Process "py" -ArgumentList "`"$pyScript`"" -WindowStyle Minimized

Write-Host "✅ Server is running." -ForegroundColor Green
Write-Host "---------------------------------------------------"
Write-Host "PLEASE USE THIS CONFIGURATION IN LOBECHAT:" -ForegroundColor Cyan
Write-Host "1. Check 'Install via Proxy' (ON)" -ForegroundColor White
Write-Host "2. URL: http://host.docker.internal:8000/manifest.json" -ForegroundColor White
Write-Host "---------------------------------------------------"
