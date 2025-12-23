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

function Destination-For-Route {
  param($route)
  $mapFile = Join-Path $NaviRoot "config\office_map.json"
  if (Test-Path $mapFile) {
    try { $map = Get-Content $mapFile -Raw | ConvertFrom-Json; if ($map.$route) { return $map.$route } } catch {}
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
foreach ($r in $rows) {
  $filename = if ($r.filename) { $r.filename } else { $r.Name }
  $route = if ($r.route) { $r.route } else { 'unknown' }
  $src = Join-Path $pkgDir $filename
  if (-not (Test-Path $src)) { Write-Warning "Missing file: $src"; continue }

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

  if (-not $Apply) { continue }

  if ($alreadyDelivered -and -not $Force) {
    Write-Warning "Skipping already delivered file (use -Force to override): $filename"
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
    try { $obj = Get-Content $destNavi -Raw | ConvertFrom-Json } catch { $obj = @{ note = 'original_navi_unreadable'; repaired = $true } }
  } else {
    $obj = @{}
  }
  $obj.delivered = @{ to = $route; delivered_at = $now; delivered_by = $env:USERNAME; package = $PackageName; method = 'copy_then_remove' }
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
}

# Package-level completion audit
$endEntry = @{
  timestamp = (Get-Date).ToString("o")
  action = "reprocess_batch_complete"
  batch_id = $batchId
  package = $PackageName
  delivered_files = $deliveredCount
  status = "completed"
}
Append-Audit -Entry $endEntry

Write-Host "Done. Delivered $deliveredCount files. (Apply: $Apply)"