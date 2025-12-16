# VBoarder Server Auto-Start Setup
# This script creates a Windows Task Scheduler task to automatically start VBoarder servers

$taskName = "VBoarder Servers"
$batchPath = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\start_servers.bat"

# Check if the batch file exists
if (!(Test-Path $batchPath)) {
    Write-Host "ERROR: Batch file not found at $batchPath" -ForegroundColor Red
    Write-Host "Please ensure start_servers.bat exists in the VBoarder directory."
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Setting up VBoarder servers to start automatically..." -ForegroundColor Green
Write-Host "Task Name: $taskName"
Write-Host "Batch File: $batchPath"
Write-Host ""

# Create the scheduled task
try {
    $action = New-ScheduledTaskAction -Execute $batchPath -WorkingDirectory "D:\05_AGENTS-AI\01_RUNTIME\VBoarder"
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Automatically starts VBoarder MCP and Status servers at user login" -Force

    Write-Host "SUCCESS: Task '$taskName' created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The task will run:"
    Write-Host "  - At user login (when you log into Windows)"
    Write-Host "  - With highest privileges"
    Write-Host "  - Even when running on battery (for laptops)"
    Write-Host ""
    Write-Host "To test: Log off and log back in, or run the task manually from Task Scheduler."
    Write-Host ""
    Write-Host "To view/manage the task:"
    Write-Host "  1. Press Win + R"
    Write-Host "  2. Type 'taskschd.msc'"
    Write-Host "  3. Find '$taskName' under Task Scheduler Library"
    Write-Host ""

} catch {
    Write-Host "ERROR: Failed to create scheduled task" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running this script as Administrator:"
    Write-Host "  Right-click this script → 'Run as administrator'"
}

Read-Host "Press Enter to exit"