param(
  [Parameter(Mandatory=$true)][string]$PackageName,
  [string]$NaviRoot = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI",
  [switch]$Apply,
  [switch]$Force
)

Set-StrictMode -Version Latest

function Atomic-WriteJson {
  param($Path, $Object)
  $tmp = "$Path.tmp"
  $Object | ConvertTo-Json -Depth 20 | Out-File -FilePath $tmp -Encoding utf8
  Move-Item -Path $tmp -Destination $Path -Force
}

function Append-Audit {
  param($Entry)
  $logDir = Join-Path $NaviRoot 'approvals'
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
  $log = Join-Path $logDir "audit.log"
  $EntryJson = $Entry | ConvertTo-Json -Compress
  Add-Content -Path $log -Value $EntryJson -Encoding UTF8
}

function Ensure-RoutePathsExist {
  # Create any configured route_paths under NAVI if they don't already exist
  $configPath = Join-Path $NaviRoot 'config\routing_config.json'
  if (-not (Test-Path $configPath)) { return }
  try { $cfg = Get-Content $configPath -Raw | ConvertFrom-Json } catch { $cfg = $null }
  if ($cfg -and $cfg.route_paths) {
    foreach ($p in $cfg.route_paths.PSObject.Properties) {
      $rel = $p.Value
      $abs = if ([System.IO.Path]::IsPathRooted($rel)) { $rel } else { Join-Path $NaviRoot $rel }
      if (-not (Test-Path $abs)) {
        New-Item -ItemType Directory -Path $abs -Force | Out-Null
        Write-Host "Created route path: $abs"
      }
    }
  }
}

# Ensure configured route paths exist before processing
Ensure-RoutePathsExist

function Destination-For-Route {
  param($route)
  # Prefer configured route_paths in routing_config.json, fallback to offices/<seg>/inbox
  $configPath = Join-Path $NaviRoot 'config\routing_config.json'
  if (Test-Path $configPath) {
    try { $cfg = Get-Content $configPath -Raw | ConvertFrom-Json } catch { $cfg = $null }
    if ($cfg -and $cfg.route_paths) {
      # exact match (case-insensitive)
      foreach ($p in $cfg.route_paths.PSObject.Properties) {
        if ($p.Name.ToLower() -eq $route.ToLower()) {
          $rel = $p.Value
          if ([System.IO.Path]::IsPathRooted($rel)) { return $rel } else { return Join-Path $NaviRoot $rel }
        }
      }
      # try suffix match (e.g., DESK.Finance -> matches Finance)
      foreach ($p in $cfg.route_paths.PSObject.Properties) {
        $parts = $p.Name -split '\.'
        if ($parts[-1].ToLower() -eq $route.ToLower()) {
          $rel = $p.Value
          if ([System.IO.Path]::IsPathRooted($rel)) { return $rel } else { return Join-Path $NaviRoot $rel }
        }
      }
    }
  }
  $seg = $route.Split('.')[0]
  return Join-Path $NaviRoot "offices\$seg\inbox"
}

# Validate package
$pkgDir = Join-Path (Join-Path $NaviRoot 'packages') $PackageName
if (-not (Test-Path $pkgDir -PathType Container)) { throw "Package not found: $pkgDir" }

# Read manifest (if present)
$manifestPath = Join-Path $pkgDir "manifest.csv"
if (-not (Test-Path $manifestPath)) {
  Write-Warning "manifest.csv missing; discovering files in package folder"
  $rows = @(Get-ChildItem -Path $pkgDir -File | Where-Object { $_.Name -notlike '*.navi.json' -and $_.Name -notlike '*.meta.json' } | Select-Object Name)
} else {
  $rows = Import-Csv $manifestPath
}

# Start package-level audit
$batchId = "deliver_${PackageName}_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$startEntry = @{
  timestamp = (Get-Date).ToString("o")
  action = "reprocess_batch_start"
  batch_id = $batchId
  package = $PackageName
  requested_by = $env:USERNAME
}
Append-Audit -Entry $startEntry

# Process files
$deliveredCount = 0
$processed = @()
foreach ($r in $rows) {
  $filename = if ($r.filename) { $r.filename } else { $r.Name }
  $route = if ($r.route) { $r.route } else { 'unknown' }
  $src = Join-Path $pkgDir $filename
  if (-not (Test-Path $src)) { Write-Warning "Missing file: $src"; $processed += [ordered]@{ filename=$filename; status='missing_source'; details=$src }; continue }

  $destDir = Destination-For-Route -route $route
  $destPath = Join-Path $destDir $filename
  $naviSrc = $src + ".navi.json"
  $metaSrc = $src + ".meta.json"
  $now = (Get-Date).ToString("o")

  # Check already delivered
  $alreadyDelivered = $false
  if (Test-Path $naviSrc) {
    try { $jn = Get-Content $naviSrc -Raw | ConvertFrom-Json; if ($jn.delivered) { $alreadyDelivered = $true } } catch {}
  }

  Write-Host "Plan: $filename -> $destDir (route: $route) AlreadyDelivered: $alreadyDelivered"

  if (-not $Apply) { $processed += [ordered]@{ filename=$filename; status='planned'; route=$route; dest=$destDir }; continue }

  if ($alreadyDelivered -and -not $Force) {
    Write-Warning "Skipping already delivered file (use -Force to override): $filename"
    $processed += [ordered]@{ filename=$filename; status='skipped_already_delivered'; route=$route; dest=$destDir }
    continue
  }

  # Ensure dest exists
  New-Item -ItemType Directory -Path $destDir -Force | Out-Null

  # Copy file + sidecars
  Copy-Item -Path $src -Destination $destPath -Force
  if (Test-Path $naviSrc) { Copy-Item -Path $naviSrc -Destination ($destPath + ".navi.json") -Force }
  if (Test-Path $metaSrc) { Copy-Item -Path $metaSrc -Destination ($destPath + ".meta.json") -Force }

  # Update delivered flag atomically on destination sidecar
  $destNavi = $destPath + ".navi.json"
  if (Test-Path $destNavi) {
    try {
      $tmp = Get-Content $destNavi -Raw
      $parsed = ConvertFrom-Json $tmp -ErrorAction Stop
      # merge into an ordered hashtable so we can safely set/override keys
      $obj = [ordered]@{}
      foreach ($p in $parsed.psobject.properties) { $obj[$p.Name] = $p.Value }
    } catch {
      $obj = @{ note = 'original_navi_unreadable'; repaired = $true }
    }
  } else {
    $obj = @{}
  }
  # set delivered using hashtable indexing to avoid property-binding issues
  $obj['delivered'] = @{ to = $route; delivered_at = $now; delivered_by = $env:USERNAME; package = $PackageName; method = 'copy_then_remove' }
  Atomic-WriteJson -Path $destNavi -Object $obj

  # Append per-file audit
  $fileAudit = @{
    timestamp = $now
    action = "deliver_file"
    file = $filename
    from = $src
    to = $destPath
    package = $PackageName
    method = "copy_then_remove"
    status = "success"
    actor = $env:USERNAME
    job_id = $batchId
  }
  Append-Audit -Entry $fileAudit

  # Remove source file and sidecars from package (after copy success)
  Remove-Item -Path $src -Force
  if (Test-Path $naviSrc) { Remove-Item -Path $naviSrc -Force }
  if (Test-Path $metaSrc) { Remove-Item -Path $metaSrc -Force }

  $deliveredCount++
  $processed += [ordered]@{ filename=$filename; status='delivered'; route=$route; dest=$destPath; delivered_at=$now }
}

# Post-delivery verification (only on Apply)
$verifyFailures = @()
if ($Apply) {
  foreach ($p in $processed) {
    if ($p.status -eq 'delivered') {
      $destPath = $p.dest
      if (-not (Test-Path $destPath)) { $verifyFailures += "Missing delivered file: $destPath"; continue }
      $destNavi = $destPath + ".navi.json"
      if (-not (Test-Path $destNavi)) { $verifyFailures += "Missing sidecar: $destNavi"; continue }
      try { $jn = Get-Content $destNavi -Raw | ConvertFrom-Json -ErrorAction Stop } catch { $verifyFailures += "Unreadable sidecar: $destNavi"; continue }
      if (-not $jn.delivered) { $verifyFailures += "Sidecar missing delivered flag: $destNavi"; continue }
    }
  }

  # Write post-delivery report
  $reportDir = Join-Path $NaviRoot 'approvals\delivery_reports'
  if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir -Force | Out-Null }
  $reportPath = Join-Path $reportDir ($batchId + '.json')
  $reportObj = [ordered]@{ package = $PackageName; batch_id = $batchId; checked_at = (Get-Date).ToString('o'); failures = $verifyFailures; processed = $processed }
  $tmp = $reportPath + '.tmp'
  $reportObj | ConvertTo-Json -Depth 10 | Out-File -FilePath $tmp -Encoding utf8
  Move-Item -Path $tmp -Destination $reportPath -Force
  Append-Audit -Entry @{ timestamp=(Get-Date).ToString('o'); action='post_delivery_verification'; batch_id=$batchId; package=$PackageName; failures=$verifyFailures; report=$reportPath }
}

# Package-level completion audit
$endEntry = @{
  timestamp = (Get-Date).ToString("o")
  action = "reprocess_batch_complete"
  batch_id = $batchId
  package = $PackageName
  delivered_files = $deliveredCount
  status = if ($verifyFailures.Count -gt 0) { 'completed_with_failures' } else { 'completed' }
}
Append-Audit -Entry $endEntry

Write-Host "Done. Delivered $deliveredCount files. (Apply: $Apply)"