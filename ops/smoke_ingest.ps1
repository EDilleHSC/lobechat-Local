<#
ops/smoke_ingest.ps1
PowerShell smoke ingest script (safe, copy-only, non-watcher trigger)
Usage:
  .\ops\smoke_ingest.ps1 -BatchName mock_test_batch_01 [-DryRun]

Behavior:
  - Verifies NAVI /health is OK
  - Refuses when NAVI inbox is non-empty
  - Refuses if this batch has been previously processed (ops/runs/processed_batches.txt)
  - Copies files from NAVI/HOLDING/<BatchName> -> NAVI/inbox (copy then atomic Move)
  - Calls POST /process and polls for artifacts (snapshot + presenter)
  - Collects artifacts into ops/runs/run_<timestamp>_<BatchName>/
  - DryRun mode prints actions but performs no copying/POST
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$BatchName,

    [switch]$DryRun,

    [int]$TimeoutSeconds = 600,

    [int]$PollIntervalSeconds = 5
)

$ErrorActionPreference = 'Stop'
# Determine repo root reliably: script is under <repo>/ops, so parent of script's directory is repo root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..') | Select-Object -ExpandProperty Path
if (-not $repoRoot) { $repoRoot = (Get-Location).Path }

$holding = Join-Path $repoRoot "NAVI\HOLDING\$BatchName"
$inbox = Join-Path $repoRoot "NAVI\inbox"
$runs = Join-Path $repoRoot "ops\runs"
$processedFile = Join-Path $runs "processed_batches.txt"

function Write-ERR($m){ Write-Host "ERROR: $m" -ForegroundColor Red }
function Write-OK($m){ Write-Host "OK: $m" -ForegroundColor Green }
function ExitFail($m){ Write-ERR $m; exit 2 }

Write-Host "Smoke ingest starting for batch '$BatchName' (dryRun=$($DryRun.IsPresent))"

# Basic validations
if (-not (Test-Path $holding)) { ExitFail "Holding folder not found: $holding" }

# Guard: refuse if holding contains a single container file (avoid accidental container processing)
$holdingFiles = Get-ChildItem -Path $holding -File -ErrorAction SilentlyContinue
if ($holdingFiles -and $holdingFiles.Count -eq 1) {
    $singleName = $holdingFiles[0].Name
    $ext = [IO.Path]::GetExtension($singleName).ToLower()
    $containerExts = @('.tmp', '.zip', '.batch')
    if ($containerExts -contains $ext -or $singleName.StartsWith('.')) {
        ExitFail "Holding folder contains a single container file '$singleName'. Please unpack or confirm before running the smoke ingest."
    }
}

if (-not (Test-Path $runs)) {
    if ($DryRun) { Write-Host "Would create runs dir: $runs" } else { New-Item -ItemType Directory -Path $runs | Out-Null }
}

# Check NAVI health
$healthUrl = 'http://localhost:8005/health'
try {
    $h = Invoke-RestMethod -Uri $healthUrl -Method GET -TimeoutSec 5 -ErrorAction Stop
} catch {
    ExitFail "NAVI health check failed: $_" }
if (-not ($h -and $h.ok -eq $true)) { ExitFail "NAVI health not OK: $($h | ConvertTo-Json -Compress)" }
Write-OK "NAVI healthy (pid=$($h.pid))"

# Ensure inbox empty
$inboxItems = Get-ChildItem -Path $inbox -File -ErrorAction SilentlyContinue
if ($inboxItems -and $inboxItems.Count -gt 0) { ExitFail "Inbox is not empty. Move or clear before running the script." }
Write-OK "Inbox is empty"

# Check processed batches
if (Test-Path $processedFile) {
    $processed = Get-Content $processedFile -ErrorAction SilentlyContinue
    if ($processed -and ($processed -contains $BatchName)) { ExitFail "Batch '$BatchName' has already been processed (found in processed_batches.txt)" }
}

# Prepare run folder
$ts = (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')
$runDir = Join-Path $runs "run_${ts}_${BatchName}"
if ($DryRun) { Write-Host "Would create run folder: $runDir" } else { New-Item -ItemType Directory -Path $runDir | Out-Null }

# Copy files: use temp then Move to inbox atomically
$tmp = Join-Path $repoRoot "NAVI\HOLDING\.${BatchName}.tmp"
if (Test-Path $tmp) { if ($DryRun) { Write-Host "Would remove existing temp: $tmp" } else { Remove-Item -Recurse -Force $tmp } }
if ($DryRun) { Write-Host "Would copy from $holding -> $tmp" } else { Copy-Item -Path "$holding\*" -Destination $tmp -Recurse -Force }

# Move to inbox (atomic-ish)
if ($DryRun) { Write-Host "Would move $tmp/* -> $inbox" } else { Get-ChildItem -Path $tmp -File -Recurse | ForEach-Object { Move-Item -Path $_.FullName -Destination $inbox -Force } }

# POST /process
$processUrl = 'http://localhost:8005/process'
$body = @{ batch = $BatchName } | ConvertTo-Json
if ($DryRun) {
    Write-Host "Would POST $processUrl with body: $body" 
} else {
    try {
        Write-Host "POSTing /process..."
        $resp = Invoke-RestMethod -Uri $processUrl -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 30 -ErrorAction Stop
        Write-OK "POST /process accepted: $($resp | ConvertTo-Json -Compress)"
    } catch {
        ExitFail "POST /process failed: $_" }
}

# Wait for artifacts: snapshot (NAVI/snapshots/inbox) + presenter generated json
$end = (Get-Date).AddSeconds($TimeoutSeconds)
$snapshotPath = Join-Path $repoRoot "NAVI\snapshots\inbox"
$presenterFile = Join-Path $repoRoot "NAVI\presenter\generated\presenter.json"
$gotSnapshot = $false; $gotPresenter = $false
while ((Get-Date) -lt $end) {
    if (-not $DryRun) {
        if (-not $gotSnapshot) {
            $latestSnap = Get-ChildItem -Path $snapshotPath -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if ($latestSnap) { $gotSnapshot = $true; Write-OK "Found snapshot: $($latestSnap.Name)"; Copy-Item $latestSnap.FullName (Join-Path $runDir 'snapshot.json') -Force }
        }
        if (-not $gotPresenter) {
            if (Test-Path $presenterFile) { $gotPresenter = $true; Write-OK "Found presenter: $presenterFile"; Copy-Item $presenterFile (Join-Path $runDir 'presenter.json') -Force }
        }
        if ($gotSnapshot -and $gotPresenter) { break }
    } else {
        Write-Host "[DryRun] Would poll for snapshot & presenter until $end"; break
    }
    Start-Sleep -Seconds $PollIntervalSeconds
}

# Collect server logs (best-effort)
$serverLogs = @(Get-ChildItem -Path "$repoRoot\runtime\current\*.log" -File -ErrorAction SilentlyContinue)
if ($serverLogs.Count -gt 0) {
    $latestLog = $serverLogs | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($DryRun) { Write-Host "Would copy server log: $($latestLog.FullName) -> $runDir\server.log" } else { Get-Content $latestLog.FullName -Tail 200 | Out-File -FilePath (Join-Path $runDir 'server.log') -Encoding utf8 }
} else {
    Write-Host "No server logs found at runtime/current" }

# Write summary
$summary = @{
    batch = $BatchName
    run_dir = $runDir
    started = $ts
    got_snapshot = $gotSnapshot
    got_presenter = $gotPresenter
    health = $h
}
if ($DryRun) { Write-Host "[DryRun] Summary: $($summary | ConvertTo-Json -Compress)" } else { $summary | ConvertTo-Json -Depth 4 | Out-File -FilePath (Join-Path $runDir 'run_summary.txt') -Encoding utf8 }

# Mark processed (append batch name)
if (-not $DryRun) { Add-Content -Path $processedFile -Value $BatchName }

Write-OK "Smoke ingest done (dryRun=$($DryRun.IsPresent))"
if (-not $DryRun) { Write-Host "Artifacts in: $runDir" }
