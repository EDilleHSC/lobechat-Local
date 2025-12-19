# Archive NAVI/approvals to backups with timestamp
param(
    [string]$ApprovalsPath = "NAVI/approvals",
    [string]$BackupDir = "backups"
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $ApprovalsPath)) { Write-Error "Approvals path not found: $ApprovalsPath"; exit 1 }
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }

$ts = (Get-Date).ToString('yyyyMMdd_HHmmss')
$zip = Join-Path $BackupDir "approvals_$ts.zip"
Write-Host "Creating backup: $zip"
Compress-Archive -Path (Join-Path $ApprovalsPath '*') -DestinationPath $zip -Force
Write-Host "Backup done: $zip"