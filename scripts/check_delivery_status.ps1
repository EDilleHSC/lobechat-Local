param(
  [string]$NaviRoot = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI",
  [string]$ReportPath = "$env:GITHUB_WORKSPACE\delivery_status_report.json",
  [switch]$FailOnEmpty
)
Set-StrictMode -Version Latest

$officesRoot = Join-Path $NaviRoot 'offices'
$report = [ordered]@{ checked_at = (Get-Date).ToString('o'); results = @(); failures = @() }
if (-not (Test-Path $officesRoot)) { Write-Host "No offices found at $officesRoot"; $report.failures += "no_offices"; $report | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 -FilePath $ReportPath; exit 1 }
$offices = Get-ChildItem -Path $officesRoot -Directory
foreach ($o in $offices) {
  $inbox = Join-Path $o.FullName 'inbox'
  if (-not (Test-Path $inbox)) {
    $report.results += [ordered]@{ office = $o.Name; inbox_exists = $false; file_count = 0 }
    $report.failures += "missing_inbox:$($o.Name)"
    continue
  }
  # exclude sidecars and meta files from file list
  $files = Get-ChildItem -Path $inbox -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '*.navi.json' -and $_.Name -notlike '*.meta.json' }
  $fileCount = ($files | Measure-Object).Count
  $badFiles = @()
  foreach ($f in $files) {
    $sidecar = $f.FullName + '.navi.json'
    if (-not (Test-Path $sidecar)) { $badFiles += "missing_sidecar:$($f.Name)"; continue }
    try { $jn = Get-Content $sidecar -Raw | ConvertFrom-Json -ErrorAction Stop } catch { $badFiles += "unreadable_sidecar:$($f.Name)"; continue }
    if (-not $jn.delivered) { $badFiles += "not_delivered_flag:$($f.Name)" }
  }
  if ($badFiles.Count -gt 0) { $report.failures += @{ office = $o.Name; issues = $badFiles } }
  $report.results += [ordered]@{ office = $o.Name; inbox_exists = $true; file_count = $fileCount; issues = $badFiles }
}

# write report
if (-not $ReportPath) { $ReportPath = Join-Path $env:TEMP ('delivery_status_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.json') }
$report | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 -FilePath $ReportPath
Write-Host "Wrote report: $ReportPath"

if ($report.failures.Count -gt 0) {
  Write-Host "Failures found: $($report.failures | ConvertTo-Json -Compress)"
  if ($FailOnEmpty) { exit 2 } else { exit 0 }
}

Write-Host "All checks passed."
exit 0
