param(
  [Parameter(Mandatory=$true)][string]$PackageName,
  [string]$NaviRoot = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI",
  [switch]$DryRun
)
Set-StrictMode -Version Latest

function Read-Config { param() $cfgPath = Join-Path $NaviRoot 'config\routing_config.json'; if (Test-Path $cfgPath) { try { return Get-Content $cfgPath -Raw | ConvertFrom-Json } catch { return $null } } else { return $null } }

function Resolve-DestinationPath { param($route)
  $cfg = Read-Config
  if ($cfg -and $cfg.route_paths) {
    # exact
    foreach ($p in $cfg.route_paths.PSObject.Properties) { if ($p.Name.ToLower() -eq $route.ToLower()) { $rel = $p.Value; if ([System.IO.Path]::IsPathRooted($rel)) { return $rel } else { return Join-Path $NaviRoot $rel } } }
    # suffix
    foreach ($p in $cfg.route_paths.PSObject.Properties) { $parts = $p.Name -split '\.'; if ($parts[-1].ToLower() -eq $route.ToLower()) { $rel = $p.Value; return if ([System.IO.Path]::IsPathRooted($rel)) { $rel } else { Join-Path $NaviRoot $rel } } }
  }
  $seg = $route.Split('.')[0]
  return Join-Path $NaviRoot "offices\$seg\inbox"
}

$pkgDir = Join-Path (Join-Path $NaviRoot 'packages') $PackageName
if (-not (Test-Path $pkgDir -PathType Container)) { throw "Package not found: $pkgDir" }

$manifestPath = Join-Path $pkgDir 'manifest.csv'
if (Test-Path $manifestPath) {
  $rows = Import-Csv $manifestPath
} else {
  # build minimal manifest
  $files = Get-ChildItem -Path $pkgDir -File | Where-Object { $_.Name -notlike '*.navi.json' -and $_.Name -notlike '*.meta.json' } | Select-Object Name
  $rows = foreach ($f in $files) { [PSCustomObject]@{ filename = $f.Name; route = 'unknown'; applied_at = (Get-Date -Format o) } }
}

# Attach delivered info from audit.log
$auditPath = Join-Path $NaviRoot 'approvals\audit.log'
$audits = @()
if (Test-Path $auditPath) {
  $raw = Get-Content $auditPath -ErrorAction SilentlyContinue
  foreach ($line in $raw) {
    try { $entry = $line | ConvertFrom-Json -ErrorAction Stop; $audits += $entry } catch { }
  }
}

$now = (Get-Date).ToString('o')
$changed = $false
foreach ($r in $rows) {
  $filename = $r.filename
  # find audit entry
  $match = $audits | Where-Object { $_.action -eq 'deliver_file' -and $_.package -eq $PackageName -and $_.file -eq $filename } | Select-Object -Last 1
  if ($match) {
    $r | Add-Member -NotePropertyName delivered_to -NotePropertyValue $match.to -Force
    $r | Add-Member -NotePropertyName delivered_at -NotePropertyValue $match.timestamp -Force
  } else {
    # attempt to resolve dest from route
    if ($r.route) {
      $destDir = Resolve-DestinationPath -route $r.route
      $r | Add-Member -NotePropertyName delivered_to -NotePropertyValue $destDir -Force
      $r | Add-Member -NotePropertyName delivered_at -NotePropertyValue '' -Force
    }
  }
  $changed = $true
}

if ($changed -and -not $DryRun) {
  # write back manifest.csv with new columns
  $out = @()
  foreach ($r in $rows) { $o = [ordered]@{}; foreach ($p in $r.PSObject.Properties) { $o[$p.Name] = $p.Value }; $out += New-Object PSObject -Property $o }
  $out | Export-Csv -Path $manifestPath -NoTypeInformation -Encoding UTF8
  Write-Host "Updated manifest: $manifestPath"

  # Update README
  $readme = Join-Path $pkgDir 'README.md'
  $summary = @()
  $summary += "# NAVI Package - $PackageName"
  $summary += "Created/Updated: $now"
  $summary += "Files packaged: $($rows.Count)"
  $summary += ''
  $summary += '## Contents and delivery status'
  foreach ($r in $rows) { $summary += "- $($r.filename) — route: $($r.route) — delivered_to: $($r.delivered_to) — delivered_at: $($r.delivered_at)" }
  $summary | Out-File -FilePath $readme -Encoding utf8
  Write-Host "Updated README: $readme"
} else { Write-Host "Dry-run: manifest/README would be updated (no changes written)" }

# Verification
$failures = @()
foreach ($r in $rows) {
  $dest = $null
  if ($r.delivered_to) { $dest = $r.delivered_to } elseif ($r.route) { $dest = Resolve-DestinationPath -route $r.route }
  if (-not $dest) { $failures += "No destination for $($r.filename)"; continue }
  $destPath = Join-Path $dest $r.filename
  if (-not (Test-Path $destPath)) { $failures += "Missing dest file: $destPath"; continue }
  $destNavi = $destPath + '.navi.json'
  if (-not (Test-Path $destNavi)) { $failures += "Missing dest sidecar: $destNavi"; continue }
  try { $jn = Get-Content $destNavi -Raw | ConvertFrom-Json } catch { $failures += "Unreadable sidecar: $destNavi"; continue }
  if (-not $jn.delivered) { $failures += "Sidecar missing delivered flag: $destNavi"; continue }
}

if ($failures.Count -gt 0) {
  Write-Host "Verification FAILED with issues:`n" + ($failures -join "`n")
  if ($DryRun) { exit 2 } else { exit 3 }
} else {
  Write-Host "Verification passed: all files exist and have delivered sidecars."
}

# Archive package
$archiveRoot = Join-Path $NaviRoot 'archive\packages'
if (-not (Test-Path $archiveRoot)) { New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null }
$archivedName = "$PackageName-archived-" + (Get-Date -Format 'yyyyMMdd_HHmmss')
$archivedPath = Join-Path $archiveRoot $archivedName
if (-not $DryRun) {
  Move-Item -Path $pkgDir -Destination $archivedPath -Force
  Write-Host "Archived package to: $archivedPath"
} else { Write-Host "Dry-run: would archive $pkgDir -> $archivedPath" }

Write-Host "Done."