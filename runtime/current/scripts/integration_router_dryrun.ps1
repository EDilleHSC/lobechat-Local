# Integration dry-run: copy 7 bills to inbox, enable routing, run router, report, restore
$root = 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder'
$navi = Join-Path $root 'NAVI'
$inbox = Join-Path $navi 'inbox'
$review = Join-Path $navi 'mail_room\review_required'
$config = Join-Path $navi 'config\routing_config.json'
$configBak = "$config.bak"

# Files to test
$files = @(
  'Bill_09052025_0001.pdf',
  'Bill_09172025_0001.pdf',
  'Bill_10062025_0001.pdf',
  'Bill_10162025_0001.pdf',
  'Bill_10282025_0001.pdf',
  'Bill_11162025_0001.pdf',
  'Receipt_04012025_0001.pdf'
)

Write-Host 'Backing up config' -ForegroundColor Cyan
Copy-Item -Path $config -Destination $configBak -Force

# Ensure enable_mailroom_routing is true
Write-Host 'Setting enable_mailroom_routing = true in routing_config.json' -ForegroundColor Cyan
(Get-Content $config -Raw) -replace '"enable_mailroom_routing"\s*:\s*(true|false)', '"enable_mailroom_routing": true' | Set-Content $config -Encoding UTF8

# Prepare inbox: copy files
$copied = @()
foreach ($f in $files) {
  $src = Join-Path $review $f
  if (-not (Test-Path $src)) { Write-Host "Missing test file: $src" -ForegroundColor Yellow; continue }
  $dst = Join-Path $inbox $f
  if (Test-Path $dst) { $dst = Join-Path $inbox ("$([IO.Path]::GetFileNameWithoutExtension($f))_testcopy$([IO.Path]::GetExtension($f))") }
  Copy-Item -Path $src -Destination $dst -Force
  $copied += $dst
}

Write-Host "Copied files to inbox: $($copied.Count)" -ForegroundColor Green

# Run router and capture output
Write-Host 'Running router.js (dry-run)' -ForegroundColor Cyan
$routerPath = Join-Path $root 'runtime\current\router.js'
$nodeOut = node $routerPath
$parsed = $null
try { $parsed = $nodeOut | ConvertFrom-Json -ErrorAction Stop } catch { Write-Host 'Router output not JSON or empty' -ForegroundColor Yellow; Write-Host $nodeOut }

if ($parsed) {
  Write-Host '\nRouter summary:' -ForegroundColor Cyan
  $parsed | Select-Object routed_files, routed_to, timestamp | ForEach-Object { $_ }
  Write-Host '\nPer-file decisions:' -ForegroundColor Cyan
  foreach ($r in $parsed.routed_files) {
    [PSCustomObject]@{
      filename = ([IO.Path]::GetFileName($r.src))
      route = $r.route
      autoRoute = $r.autoRoute
      sidecar = $r.sidecar
    } | Format-Table -AutoSize
    # show sidecar content briefly
    if (Test-Path $r.sidecar) {
      $s = Get-Content $r.sidecar -Raw | ConvertFrom-Json
      Write-Host "  sidecar -> entity: $($s.entity), function: $($s.function), confidence: $($s.confidence)" -ForegroundColor Yellow
      Write-Host "  reasons: $($s.reasons -join '; ')" -ForegroundColor Yellow
    }
  }
}

# Cleanup: remove copied files and their sidecars
Write-Host '\nCleaning up copied inbox files and sidecars' -ForegroundColor Cyan
foreach ($p in $copied) {
  $sc = $p + '.navi.json'
  if (Test-Path $p) { Remove-Item $p -Force }
  if (Test-Path $sc) { Remove-Item $sc -Force }
}

# Restore routing_config.json
Write-Host 'Restoring original routing_config.json' -ForegroundColor Cyan
Copy-Item -Path $configBak -Destination $config -Force
Remove-Item $configBak -Force

Write-Host 'Integration dry-run complete' -ForegroundColor Green
