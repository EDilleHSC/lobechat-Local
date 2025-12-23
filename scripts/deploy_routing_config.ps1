param(
  [string]$NaviRoot = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI",
  [switch]$DoIt
)

Set-StrictMode -Version Latest

$cfgPath = Join-Path $NaviRoot 'config\routing_config.json'
$backupPath = Join-Path $NaviRoot 'config\routing_config.backup.json'
$offices = @('GYFOLE','COS','AIR','EXEC','CFO','CLO','COO','CSO','CMO','CTO','NAVI','DREW')

Write-Host "Config: $cfgPath"
if (-not (Test-Path $cfgPath)) { Write-Error "Config not found: $cfgPath"; exit 2 }

if ($DoIt) {
  Copy-Item -Path $cfgPath -Destination $backupPath -Force
  Write-Host "Backed up current config to: $backupPath"

  foreach ($office in $offices) {
    $path = Join-Path $NaviRoot (Join-Path "offices" (Join-Path $office 'inbox'))
    if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null; Write-Host "Created: $path" }
    else { Write-Host "Exists: $path" }
  }

  Write-Host "Deployment complete. Validating load..."
  try {
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    Write-Host "Config loaded: agents=$($cfg.agents.PSObject.Properties.Count) functions=$($cfg.function_to_office.PSObject.Properties.Count)"
  } catch { Write-Error "Failed to parse config: $_"; exit 3 }
} else {
  Write-Host "Dry-run: no changes made. Use -DoIt to perform deploy."
  Write-Host "Will create offices: $($offices -join ', ')"
  Write-Host "Backup path would be: $backupPath"
}

exit 0
