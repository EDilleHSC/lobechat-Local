# Polling-based auto-processing watcher for NAVI
# Polls NAVI/inbox every N seconds and triggers router + mailroom when changes detected.

param(
    [int]$IntervalSeconds = 2,
    [switch]$ProcessExisting
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path -Path (Join-Path $scriptDir '..') | Select-Object -ExpandProperty Path
$naviRoot = Join-Path $repoRoot 'NAVI'
$inbox = Join-Path $naviRoot 'inbox'
$log = Join-Path $naviRoot 'logs\auto_process.log'

if (-not (Test-Path $inbox)) {
    New-Item -ItemType Directory -Path $inbox -Force | Out-Null
}
if (-not (Test-Path (Split-Path $log -Parent))) { New-Item -ItemType Directory -Path (Split-Path $log -Parent) -Force | Out-Null }

$startupMsg = "Starting NAVI polling watcher. RepoRoot: $repoRoot, Inbox: $inbox (interval ${IntervalSeconds}s)"
$startupMsg | Out-File -FilePath $log -Append
Write-Output $startupMsg

# Guard: do not run watcher inside CI (GitHub Actions or other CI providers)
if ($env:GITHUB_ACTIONS -eq 'true' -or $env:CI -eq 'true') {
    "CI environment detected; exiting watcher." | Out-File -FilePath $log -Append
    Write-Output "CI environment detected; exiting watcher."
    exit 0
}

# state
$global:lastSnapshot = @{}
function Build-Snapshot {
    param($dir)
    $map = @{}
    Get-ChildItem -Path $dir -Recurse -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
        $rel = $_.FullName.Substring($dir.Length+1)
        $map[$rel] = $_.LastWriteTimeUtc.Ticks
    }
    return $map
}

# initial snapshot
if ($ProcessExisting) {
    # If testing, treat all existing files as new so the first loop runs
    $global:lastSnapshot = @{}
    $runOnce = $true
} else {
    $global:lastSnapshot = Build-Snapshot -dir $inbox
    $runOnce = $false
}

while ($true) {
    Start-Sleep -Seconds $IntervalSeconds
    try {
        $current = Build-Snapshot -dir $inbox
        # debug: log counts
        $ts = Get-Date -Format u
        $msg = "[$ts] Snapshot: current=$($current.Keys.Count), last=$($global:lastSnapshot.Keys.Count)"
        $msg | Out-File -FilePath $log -Append
        Write-Output $msg
        # detect added or modified
        $addedOrChanged = @()
        foreach ($k in $current.Keys) {
            if (-not $global:lastSnapshot.ContainsKey($k) -or $current[$k] -ne $global:lastSnapshot[$k]) { $addedOrChanged += $k }
        }
        if ($addedOrChanged.Count -gt 0) {
            $ts = Get-Date -Format u
            $msg2 = "[$ts] Detected changes: $($addedOrChanged -join ', ')"
            $msg2 | Out-File -FilePath $log -Append
            Write-Output $msg2
            # Run router
            Push-Location -Path $repoRoot
            try {
                $node = 'node'
                $router = Join-Path $repoRoot 'runtime\current\router.js'
                "[$ts] Running router apply..." | Out-File -FilePath $log -Append
                & $node $router --apply --force 2>&1 | Out-File -FilePath $log -Append
            } catch {
                "[$ts] Router failed: $_" | Out-File -FilePath $log -Append
            } finally { Pop-Location }

            # Run mailroom
            $py = $env:MAILROOM_PYTHON
            if (-not $py) { $py = 'C:\Users\PC\anaconda3\python.exe' }
            $mailroom = Join-Path $repoRoot 'runtime\mailroom_runner.py'
            "[$ts] Running mailroom with $py (script: $mailroom)" | Out-File -FilePath $log -Append
            try {
                # Use Push-Location to ensure python run context is repo root
                Push-Location -Path $repoRoot
                & $py $mailroom 2>&1 | Out-File -FilePath $log -Append
            } catch {
                "[$ts] Mailroom failed: $_" | Out-File -FilePath $log -Append
            } finally { Pop-Location }

            # update snapshot after processing
            $global:lastSnapshot = Build-Snapshot -dir $inbox

            if ($runOnce) { "[$ts] ProcessExisting run completed, exiting." | Out-File -FilePath $log -Append; break }
        }
    } catch {
        $ts = Get-Date -Format u
        "[$ts] Watcher error: $_" | Out-File -FilePath $log -Append
    }
}