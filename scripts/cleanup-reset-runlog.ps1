<#
.SYNOPSIS
  NAVI cleanup + backup utility with safe defaults and auditing.

.DESCRIPTION
  - Resolves NAVI root robustly (env var, parameter, repo-relative)
  - Supports -DryRun and -WhatIf / -Confirm semantics
  - Uses Safe-* helpers to make destructive actions predictable
  - Writes a structured run report to NAVI\approvals\cleanup_reports
#>

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
  [string]$NaviRoot,
  [ValidateSet('tests','all')][string]$Scope = 'tests',
  [switch]$DryRun,
  [switch]$Confirm,
  [string]$BackupRootOverride
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Timestamp { (Get-Date).ToString('yyyyMMdd_HHmmss') }
$ts = Timestamp

# Fix A: Robust NAVI root resolution
if (-not $NaviRoot) {
  if ($env:NAVI_ROOT) { $NaviRoot = $env:NAVI_ROOT }
  else {
    $scriptDir = if ($PSCommandPath) { Split-Path -Parent $PSCommandPath } elseif ($MyInvocation -and $MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { (Get-Location).Path }
    $candidate = Resolve-Path -Path (Join-Path $scriptDir '..\NAVI') -ErrorAction SilentlyContinue
    if ($candidate) { $NaviRoot = $candidate.ProviderPath } else { throw "NAVI root not specified and cannot be resolved. Set -NaviRoot or NAVI_ROOT env var." }
  }
}
$NaviRoot = (Resolve-Path -Path $NaviRoot -ErrorAction Stop).ProviderPath

$archiveRoot = if ($BackupRootOverride) { $BackupRootOverride } else { Join-Path $NaviRoot 'archive' }
$backupDir = Join-Path $archiveRoot "cleanup-backup_$ts"
$backupZip = "$backupDir.zip"

# Helpers (Fix B)
function Ensure-Dir { param($Path) if (-not (Test-Path $Path)) { if ($DryRun) { Write-Host "[DRYRUN] CreateDir: $Path" } else { New-Item -ItemType Directory -Path $Path -Force | Out-Null } } }

function Safe-Move { param($Src, $Dst) if ($DryRun) { Write-Host "[DRYRUN] Move: $Src -> $Dst"; return } Move-Item -LiteralPath $Src -Destination $Dst -Force }
function Safe-Remove { param($Path) if ($DryRun) { Write-Host "[DRYRUN] Remove: $Path"; return } Remove-Item -LiteralPath $Path -Recurse -Force }
function Safe-WriteAtomic { param($Path, $Content) if ($DryRun) { Write-Host "[DRYRUN] Write: $Path"; return } $tmp = "$Path.tmp"; $Content | Out-File -FilePath $tmp -Encoding utf8; Move-Item -LiteralPath $tmp -Destination $Path -Force }
function Safe-Copy { param($Src, $Dst) if ($DryRun) { Write-Host "[DRYRUN] Copy: $Src -> $Dst"; return } Copy-Item -LiteralPath $Src -Destination $Dst -Recurse -Force }

# Paths map
$paths = @{
  packages = Join-Path $NaviRoot 'packages'
  offices = Join-Path $NaviRoot 'offices'
  approvals = Join-Path $NaviRoot 'approvals'
  presenter_cache = Join-Path $NaviRoot 'presenter_cache'
  temp = Join-Path $NaviRoot 'temp'
  quarantine = Join-Path $NaviRoot 'quarantine'
  runtime_tests = Join-Path $NaviRoot 'runtime'
  logs = Join-Path $NaviRoot 'logs'
}

# Determine items to backup & clear based on scope
if ($Scope -eq 'tests') {
  $toBackup = @($paths.runtime_tests, $paths.temp) | Where-Object { Test-Path $_ }
  $toClear = @((Join-Path $paths.runtime_tests 'current\test'), $paths.temp) | Where-Object { Test-Path $_ }
} else {
  $toBackup = @($paths.packages, $paths.offices, $paths.approvals, $paths.presenter_cache, $paths.temp, $paths.quarantine, $paths.runtime_tests, $paths.logs) | Where-Object { Test-Path $_ }
  $toClear = @((Join-Path $paths.packages '*'), (Join-Path $paths.offices '*\inbox\*'), (Join-Path $paths.approvals 'delivery_reports\*'), (Join-Path $paths.approvals 'revert_reports\*'), (Join-Path $paths.approvals 'audit.log'), (Join-Path $paths.presenter_cache '*'), (Join-Path $paths.temp '*'), (Join-Path $paths.quarantine '*'))
}

# Dry-run summary
Write-Host "==== Cleanup plan (scope: $Scope) ===="
Write-Host "NAVI root: $NaviRoot"
Write-Host "Backup location (will be created): $backupDir"
Write-Host "Items to backup:"
$toBackup | ForEach-Object { Write-Host " - $_" }
Write-Host "`nItems to clear:"
$toClear | ForEach-Object { Write-Host " - $_" }

if ($DryRun) { Write-Host "`nDRY RUN mode — no changes will be made." } else { if (-not $Confirm) { throw "This operation is destructive. Rerun with -Confirm to perform the cleanup (or use -WhatIf to preview)." } }

# Prepare run report object
$reportDir = Join-Path $NaviRoot 'approvals\cleanup_reports'
$report = [ordered]@{ timestamp=(Get-Date).ToString('o'); scope=$Scope; naviRoot=$NaviRoot; backupDir=$backupDir; backupZip=$backupZip; backedUp=@(); backupFailures=@(); cleared=@(); clearFailures=@(); warnings=@() }

# Create backup dir if executing
if ($DryRun) { Write-Host "`n[DRYRUN] Would create backup folder: $backupDir" } else { Write-Host "`nCreating backup folder: $backupDir"; Ensure-Dir $backupDir }

foreach ($p in $toBackup) {
  try {
    if (-not (Test-Path $p)) { Write-Warning "Source not found, skipping backup: $p"; $report.warnings += "Backup source missing: $p"; continue }
    $name = Split-Path $p -Leaf
    if ($name -eq '*') { $name = (Split-Path $p -Parent) | Split-Path -Leaf }
    $dst = Join-Path $backupDir $name
    if ($DryRun) { Write-Host "[DRYRUN] Would copy: $p -> $dst"; $report.backedUp += @{ source=$p; destination=$dst; dryRun=$true } }
    else {
      Write-Host "Backing up: $p -> $dst"
      try { Safe-Copy -Src $p -Dst $dst; $report.backedUp += @{ source=$p; destination=$dst; success=$true } } catch { Write-Warning "Backup failed for $p : $_"; $report.backupFailures += @{ source=$p; exception=$_.Exception.Message } }
    }
  } catch { Write-Warning "Unexpected backup error for $p : $_"; $report.backupFailures += @{ source=$p; exception=$_.Exception.Message } }
}

# Zip the backup (if not dry-run)
if ($DryRun) { Write-Host "[DRYRUN] Would create zip: $backupZip" } else {
  try {
    Write-Host "Creating backup zip: $backupZip"
    if (Test-Path $backupZip) { Write-Host "Removing existing zip: $backupZip"; Safe-Remove -Path $backupZip }
    Ensure-Dir (Split-Path -Parent $backupZip)
    Compress-Archive -Path (Join-Path $backupDir '*') -DestinationPath $backupZip -Force
    Write-Host "Backup zip created: $backupZip"
  } catch { Write-Warning "Failed to zip backup: $_"; $report.backupFailures += @{ source='zip'; exception=$_.Exception.Message } }
}

# Now clear items (if confirmed and not DryRun)
if (-not $DryRun) {
  Write-Host "`nProceeding to clear configured items..."
  foreach ($pattern in $toClear) {
    try {
      $resolved = Get-ChildItem -Path $pattern -Recurse -Force -ErrorAction SilentlyContinue
      if ($null -eq $resolved) { Write-Host "Nothing found for: $pattern"; continue }
      foreach ($item in $resolved) {
        $actionDesc = if ($item.PSIsContainer) { 'Remove folder' } else { 'Remove file' }
        if ($PSCmdlet.ShouldProcess($item.FullName, $actionDesc)) {
          try {
            if ($item.PSIsContainer) { Safe-Remove -Path $item.FullName } else { Safe-Remove -Path $item.FullName }
            $report.cleared += @{ path=$item.FullName; success=$true }
            Write-Host "$($actionDesc): $($item.FullName)"
          } catch { Write-Warning "Failed to remove $($item.FullName): $_"; $report.clearFailures += @{ path=$item.FullName; exception=$_.Exception.Message } }
        } else { Write-Host "Skipped by ShouldProcess: $($item.FullName)"; $report.warnings += "Skipped by ShouldProcess: $($item.FullName)" }
      }
    } catch { Write-Warning "Failed to clear pattern $pattern : $_"; $report.clearFailures += @{ pattern = $pattern; exception = $_.Exception.Message } }
  }

  # Rotate audit.log to audit.log.bak.TIMESTAMP and create fresh audit.log with header
  $auditPath = Join-Path $NaviRoot 'approvals\audit.log'
  if (Test-Path $auditPath) {
    $auditBak = "$auditPath.bak.$ts"
    Write-Host "Rotating audit.log -> $auditBak"
    Safe-Move -Src $auditPath -Dst $auditBak
  }
  Write-Host "Creating fresh audit.log header"
  $jsonHeader = @{ timestamp=(Get-Date).ToString('o'); action='audit_reset'; note='start new runlog' } | ConvertTo-Json -Compress
  Safe-WriteAtomic -Path $auditPath -Content $jsonHeader
  $report.cleared += @{ path=$auditPath; note='rotated and reinitialized' }

  # Create an initial run marker file
  $runMarker = Join-Path $NaviRoot 'approvals\run_start.json'
  $markerObj = @{ started_at=(Get-Date).ToString('o'); scope=$Scope; backup=$backupZip }
  Safe-WriteAtomic -Path $runMarker -Content ($markerObj | ConvertTo-Json -Depth 6)
  Write-Host "Wrote run start marker: $runMarker"
  $report.cleared += @{ path=$runMarker; note='run marker created' }

  # Optional: clear presenter cache dir if exists
  if (Test-Path $paths.presenter_cache) {
    Write-Host "Clearing presenter cache: $($paths.presenter_cache)"
    try { Safe-Remove -Path (Join-Path $paths.presenter_cache '*'); $report.cleared += @{ path=$paths.presenter_cache; note='presenter cache cleared' } } catch { Write-Warning "Failed to clear presenter cache: $_"; $report.clearFailures += @{ path=$paths.presenter_cache; exception=$_.Exception.Message } }
  }

  Write-Host "Cleanup completed. Backup located at: $backupDir and $backupZip"
} else {
  Write-Host "`n[DRYRUN] No destructive actions performed. To execute run this again without -DryRun and with -Confirm (or use -WhatIf)."
  $report.warnings += 'Dry run only. No destructive actions performed.'
}

# Final check: run the delivery status check (in dry-run we just report)
$scriptDir = if ($PSCommandPath) { Split-Path -Parent $PSCommandPath } elseif ($MyInvocation -and $MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { (Get-Location).Path }
$checkScript = Join-Path $scriptDir 'check_delivery_status.ps1'
if (Test-Path $checkScript) {
  if ($DryRun) {
    Write-Host "[DRYRUN] Would run: pwsh -File $checkScript -NaviRoot `"$NaviRoot`" -ReportPath `"$env:TEMP\post_cleanup_check_$ts.json`" -FailOnEmpty"
    $report.warnings += "Would run post-check script: $checkScript"
  } else {
    Write-Host "Running post-cleanup delivery check..."
    pwsh -NoProfile -ExecutionPolicy Bypass -File $checkScript -NaviRoot $NaviRoot -ReportPath (Join-Path $env:TEMP "post_cleanup_check_$ts.json") -FailOnEmpty
    Write-Host "Post-check report: $env:TEMP\post_cleanup_check_$ts.json"
    $report.post_check = (Join-Path $env:TEMP "post_cleanup_check_$ts.json")
  }
}

# Write run report
if ($DryRun) { Write-Host "[DRYRUN] Would write run report to: $reportDir\cleanup_$ts.json" } else {
  Ensure-Dir $reportDir
  $reportPath = Join-Path $reportDir ("cleanup_$ts.json")
  try { $report | ConvertTo-Json -Depth 6 | Out-File -FilePath $reportPath -Encoding utf8; Write-Host "Run report written: $reportPath" } catch { Write-Warning "Failed to write run report: $_" }
}

# Exit code on failures
if (-not $DryRun -and ($report.backupFailures.Count -gt 0 -or $report.clearFailures.Count -gt 0)) { Write-Warning "Some operations failed. Check report: $reportPath"; exit 2 }

Write-Host "Done."