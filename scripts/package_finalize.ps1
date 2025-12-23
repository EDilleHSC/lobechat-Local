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
  # find deliver_file audit entries safely (some audit lines are non-JSON)
  $match = $audits | Where-Object { (Get-Member -InputObject $_ -Name 'action' -ErrorAction SilentlyContinue) -and ($_.action -eq 'deliver_file') -and ($_.package -eq $PackageName) -and ($_.file -eq $filename) } | Select-Object -Last 1
  if ($match) {
    # normalize 'to' into a directory and file to avoid double-joining later
    $toVal = $match.to
    if ($toVal) {
      if (Test-Path $toVal -PathType Leaf -ErrorAction SilentlyContinue) {
        $destDir = Split-Path $toVal -Parent
        $destFile = Split-Path $toVal -Leaf
      } else {
        # if it looks like a file path by ending with the filename, split; otherwise assume it's dir
        if ($toVal -like "*\$filename") { $destDir = Split-Path $toVal -Parent; $destFile = Split-Path $toVal -Leaf } else { $destDir = $toVal; $destFile = $filename }
      }
    } else { $destDir = $null; $destFile = $filename }

    $r | Add-Member -NotePropertyName delivered_to -NotePropertyValue $destDir -Force
    $r | Add-Member -NotePropertyName delivered_at -NotePropertyValue $match.timestamp -Force
    $r | Add-Member -NotePropertyName delivered_file -NotePropertyValue $destFile -Force
  } else {
    # attempt to resolve dest from route
    if ($r.route) {
      $destDir = Resolve-DestinationPath -route $r.route
      $r | Add-Member -NotePropertyName delivered_to -NotePropertyValue $destDir -Force
      $r | Add-Member -NotePropertyName delivered_at -NotePropertyValue '' -Force
      $r | Add-Member -NotePropertyName delivered_file -NotePropertyValue $r.filename -Force
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
  $destDir = $null
  if ($r.delivered_to) { $destDir = $r.delivered_to } elseif ($r.route) { $destDir = Resolve-DestinationPath -route $r.route }
  if (-not $destDir) { $failures += "No destination for $($r.filename)"; continue }
  # if delivered_file present, use that; else use manifest filename
  $fileToCheck = if ($r.delivered_file) { $r.delivered_file } else { $r.filename }
  $destPath = if (Test-Path $destDir -PathType Leaf -ErrorAction SilentlyContinue) { $destDir } else { Join-Path $destDir $fileToCheck }
  if (-not (Test-Path $destPath)) { $failures += "Missing dest file: $destPath"; continue }
  $destNavi = $destPath + '.navi.json'
  if (-not (Test-Path $destNavi)) { $failures += "Missing dest sidecar: $destNavi"; continue }
  try { $jn = Get-Content $destNavi -Raw | ConvertFrom-Json } catch { $failures += "Unreadable sidecar: $destNavi"; continue }
  if (-not $jn.delivered) { $failures += "Sidecar missing delivered flag: $destNavi"; continue }

  # compute and record SHA256 checksum for delivered file and write into destination meta
  try {
    $hash = (Get-FileHash -Algorithm SHA256 -Path $destPath).Hash
    $r | Add-Member -NotePropertyName delivered_sha256 -NotePropertyValue $hash -Force

    # update destination meta.json (if present) with sha256 and verified:true
    $destMeta = $destPath + '.meta.json'
    if (Test-Path $destMeta) {
      try {
        $metaObj = Get-Content $destMeta -Raw | ConvertFrom-Json -ErrorAction Stop
      } catch { $metaObj = @{} }
      $metaObj.sha256 = $hash
      $metaObj.verified = $true
      # atomic write
      $tmpmeta = $destMeta + '.tmp'
      $metaObj | ConvertTo-Json -Depth 10 | Out-File -FilePath $tmpmeta -Encoding utf8
      Move-Item -Path $tmpmeta -Destination $destMeta -Force
    } else {
      # create meta with checksum
      $metaObj = @{ filename = $fileToCheck; sha256 = $hash; verified = $true; updated_at = (Get-Date).ToString('o') }
      $tmpmeta = $destMeta + '.tmp'
      $metaObj | ConvertTo-Json -Depth 10 | Out-File -FilePath $tmpmeta -Encoding utf8
      Move-Item -Path $tmpmeta -Destination $destMeta -Force
    }
  } catch {
    $failures += "Checksum compute/update failed for $destPath : $($_.Exception.Message)"
    continue
  }
}

if ($failures.Count -gt 0) {
  $status = 'failed'
  Write-Host "Verification FAILED with issues:`n" + ($failures -join "`n")
} else {
  $status = 'passed'
  Write-Host "Verification passed: all files exist and have delivered sidecars."
}

# Create verification report (always write, even on DryRun)
$report = [ordered]@{
  package = $PackageName
  checked_at = (Get-Date).ToString('o')
  status = $status
  failures = $failures
  files = @()
}
foreach ($r in $rows) {
  $report.files += [ordered]@{
    filename = $r.filename
    route = $r.route
    applied_at = $r.applied_at
    delivered_to = $r.delivered_to
    delivered_at = $r.delivered_at
    delivered_file = $r.delivered_file
    sha256 = if ($r.delivered_sha256) { $r.delivered_sha256 } else { $null }
  }
}
$reportPath = Join-Path $pkgDir 'verify_report.json'
$tmpReport = $reportPath + '.tmp'
$report | ConvertTo-Json -Depth 10 | Out-File -FilePath $tmpReport -Encoding utf8
Move-Item -Path $tmpReport -Destination $reportPath -Force
Write-Host "Wrote verification report: $reportPath"

# Archive package
$archiveRoot = Join-Path $NaviRoot 'archive\packages'
if (-not (Test-Path $archiveRoot)) { New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null }
$archivedName = "$PackageName-archived-" + (Get-Date -Format 'yyyyMMdd_HHmmss')
$archivedPath = Join-Path $archiveRoot $archivedName
if (-not $DryRun) {
  Move-Item -Path $pkgDir -Destination $archivedPath -Force
  # ensure report moved too
  Write-Host "Archived package to: $archivedPath"
  Write-Host "Verification status: $status"
  if ($status -ne 'passed') { exit 3 }
} else { Write-Host "Dry-run: would archive $pkgDir -> $archivedPath"; if ($status -ne 'passed') { exit 2 } }

Write-Host "Done."