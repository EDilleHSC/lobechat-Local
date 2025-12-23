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

    # Optional mode: e.g. 'KB' to invoke KB ingest behavior via ?mode=KB
    [string]$Mode = '',

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

# Staging: copy to NAVI\.staging\<BatchName> outside inbox to avoid watcher races
$stagingRoot = Join-Path $repoRoot "NAVI\.staging"
$staging = Join-Path $stagingRoot $BatchName

if (Test-Path $staging) { if ($DryRun) { Write-Host "Would remove existing staging: $staging" } else { Remove-Item -Recurse -Force $staging } }
if ($DryRun) { Write-Host "Would copy from $holding -> $staging" } else { New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null; 
    # Use robocopy for deterministic, reliable copy semantics on Windows. Fall back to Copy-Item if robocopy is not available.
    $robocopyExists = (Get-Command robocopy -ErrorAction SilentlyContinue) -ne $null
    if ($robocopyExists) {
        Write-Host "Using robocopy to copy files to staging"
        & robocopy $holding $staging /E /COPY:DAT /R:2 /W:1 | Out-Null
        if ($LASTEXITCODE -ge 8) { ExitFail "Robocopy failed with exit code $LASTEXITCODE" }
    } else {
        Write-Host "robocopy not found; using Copy-Item"
        Copy-Item -Path "$holding\*" -Destination $staging -Recurse -Force
    }
}

# Verify staging completeness against holding (deterministic)
$expectedCount = (Get-ChildItem -Path $holding -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
$stagingCount = (Get-ChildItem -Path $staging -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
if (-not $DryRun) {
    if ($stagingCount -ne $expectedCount) { ExitFail "Staging incomplete: expected $expectedCount files in staging, found $stagingCount" }
}

# Atomic publish: move files from staging to inbox (source is outside inbox so watcher won't see partial state)
if ($DryRun) {
    Write-Host "Would move files from staging to inbox: $staging -> $inbox"
} else {
    Get-ChildItem -Path $staging -File -Recurse | ForEach-Object { Move-Item -Path $_.FullName -Destination (Join-Path $inbox $_.Name) -Force }
}

# Stability gate: wait for inbox to reach expected count (no guessing)
if (-not $DryRun -and $expectedCount -gt 0) {
    $stable = $false
    for ($i=0; $i -lt 10; $i++) {
        Start-Sleep -Milliseconds 300
        $count = (Get-ChildItem -Path $inbox -File -ErrorAction SilentlyContinue | Measure-Object).Count
        Write-Host ("Inbox check {0}/10: found {1}, expecting {2}" -f ($i+1), $count, $expectedCount)
        if ($count -eq $expectedCount) { $stable = $true; break }
    }
    if (-not $stable) { ExitFail "Inbox unstable: expected $expectedCount files, saw $count" }
}

# Cleanup staging (best-effort)
if (-not $DryRun) { Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue }

# POST /process
# Build process URL; optionally attach ?mode=<Mode> for special modes like KB
$processUrl = 'http://localhost:8005/process'
if ($Mode -and $Mode -ne '') { $processUrl = $processUrl + '?mode=' + $Mode }
$body = @{ batch = $BatchName } | ConvertTo-Json
$expectedCount = 0
if (-not $DryRun) { $expectedCount = (Get-ChildItem -Path $holding -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count }

function Do-PostProcess {
    param($url, $body)
    try {
        Write-Host "POSTing /process (mode=$Mode)..."
        Write-Host "DEBUG: processUrl=[$url]"
        Write-Host "DEBUG: body=$body"
        $resp = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 30 -ErrorAction Stop
        Write-OK "POST /process accepted: $($resp | ConvertTo-Json -Compress)"
        return $resp
    } catch {
        Write-Host "DEBUG EXCEPTION TYPE: $($_.GetType().FullName)"
        Write-Host "DEBUG EXCEPTION: $($_.Exception.Message)"
        Write-Host "DEBUG FULL: $($_ | Out-String)"
        throw $_
    }
}

if ($DryRun) {
    Write-Host "Would POST $processUrl with body: $body" 
} else {
    try {
        $resp = Do-PostProcess $processUrl $body

        # Single POST only (atomic ingestion): do not retry here; artifacts will be validated after they appear
        # $resp already contains the POST response, continue to artifact polling below which will validate snapshot/presenter state
        $resp = $resp

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
        if ($gotSnapshot -and $gotPresenter) { 
            # Validate snapshot exceptions meet expected file count by waiting for the system to finish processing (no re-POSTing)
            $snapOk = $false
            $snapEnd = (Get-Date).AddSeconds([Math]::Min(30, $TimeoutSeconds))
            while ((Get-Date) -lt $snapEnd) {
                try {
                    $snapJson = Get-Content (Join-Path $runDir 'snapshot.json') -Raw | ConvertFrom-Json -ErrorAction Stop
                    $foundExceptions = 0
                    if ($snapJson -and $snapJson.exceptionCount -ne $null) { $foundExceptions = $snapJson.exceptionCount }
                } catch {
                    $foundExceptions = 0
                }
                Write-Host ("Waiting for snapshot to reflect expected files: found {0}, expected {1}" -f $foundExceptions, $expectedCount)
                if ($expectedCount -eq 0 -or $foundExceptions -ge $expectedCount) { $snapOk = $true; break }
                Start-Sleep -Seconds 1
            }
            if (-not $snapOk) { ExitFail "Snapshot did not reach expected exception count in time: expected $expectedCount, last_seen $foundExceptions" }
            break }

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
