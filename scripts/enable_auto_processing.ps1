# Auto-processing watcher for NAVI
# Watches `NAVI/inbox` for new files and triggers router apply then mailroom delivery.

param()

$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot '..')
$naviRoot = Join-Path $repoRoot 'NAVI'
$inbox = Join-Path $naviRoot 'inbox'
$log = Join-Path $naviRoot 'logs\auto_process.log'

if (-not (Test-Path $inbox)) {
    Write-Output "Inbox not found at $inbox. Creating..."
    New-Item -ItemType Directory -Path $inbox -Force | Out-Null
}

Write-Output "Starting NAVI auto-processing watcher. Inbox: $inbox" | Tee-Object -FilePath $log -Append

# Guard: do not run watcher inside CI (GitHub Actions or other CI providers)
if ($env:GITHUB_ACTIONS -eq 'true' -or $env:CI -eq 'true') {
    "CI environment detected; exiting watcher." | Tee-Object -FilePath $log -Append
    Write-Output "CI environment detected; exiting watcher."
    exit 0
}

$fsw = New-Object System.IO.FileSystemWatcher $inbox -Property @{IncludeSubdirectories = $false; NotifyFilter = [IO.NotifyFilters]'FileName, LastWrite'; Filter='*.*'}

# debounce helper
$global:debounceTimer = $null
function Trigger-Processing {
    # small debounce to let uploads finish
    if ($global:debounceTimer) { return }
    $global:debounceTimer = $true
    Start-Sleep -Seconds 2

    $timestamp = Get-Date -Format u
    "[$timestamp] Triggering router apply..." | Out-File -FilePath $log -Append

    # Run router apply
    Push-Location -Path $repoRoot
    try {
        $node = 'node'
        $router = Join-Path $repoRoot 'runtime\current\router.js'
        & $node $router --apply --force 2>&1 | Out-File -FilePath $log -Append
    } catch {
        "Router failed: $_" | Out-File -FilePath $log -Append
    } finally {
        Pop-Location
    }

    # Run mailroom
    $py = $env:MAILROOM_PYTHON
    if (-not $py) { $py = 'C:\Users\PC\anaconda3\python.exe' }

    $mailroom = Join-Path $repoRoot 'runtime\mailroom_runner.py'
    "[$timestamp] Running mailroom with $py" | Out-File -FilePath $log -Append
    try {
        & $py $mailroom 2>&1 | Out-File -FilePath $log -Append
    } catch {
        "Mailroom failed: $_" | Out-File -FilePath $log -Append
    }

    # reset debounce
    $global:debounceTimer = $null
}

# Ensure logs directory exists and make watcher persistent in global scope
$logDir = Split-Path $log -Parent
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

$global:fsw = $fsw

# Register events with explicit logging (use computed log path for event runspaces)
$absLog = $log
Register-ObjectEvent -InputObject $global:fsw -EventName Created -Action {
    $ts = Get-Date -Format u
    $name = $Event.SourceEventArgs.Name
    "[$ts] Event: Created - $name" | Out-File -FilePath $absLog -Append
    Trigger-Processing
} | Out-Null

Register-ObjectEvent -InputObject $global:fsw -EventName Renamed -Action {
    $ts = Get-Date -Format u
    $name = $Event.SourceEventArgs.Name
    "[$ts] Event: Renamed - $name" | Out-File -FilePath $absLog -Append
    Trigger-Processing
} | Out-Null

# Keep script running until user stops it
Write-Output "Watcher registered. Press Ctrl+C to stop." | Tee-Object -FilePath $log -Append
while ($true) { Start-Sleep -Seconds 3600 }