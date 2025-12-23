param(
  [Parameter(Mandatory=$true)][string]$Office,
  [string]$NaviRoot = "D:\\05_AGENTS-AI\\01_RUNTIME\\VBoarder\\NAVI",
  [switch]$DryRun,
  [switch]$Archive,
  [string]$ArchiveRoot
)
Set-StrictMode -Version Latest

# Determine inbox path
$inbox = Join-Path $NaviRoot (Join-Path "offices" (Join-Path $Office 'inbox'))
if (-not (Test-Path $inbox -PathType Container)) { throw "Inbox not found: $inbox" }

if ($Archive -and -not $ArchiveRoot) { $ArchiveRoot = Join-Path $NaviRoot 'archive/inbox-archives' }
if ($Archive -and -not (Test-Path $ArchiveRoot)) { if ($DryRun) { Write-Host "Dry-run: would create archive root: $ArchiveRoot" } else { New-Item -ItemType Directory -Path $ArchiveRoot -Force | Out-Null } }

$items = Get-ChildItem -Path $inbox -Force -File -Recurse
Write-Host "Found $($items.Count) items in $inbox"

foreach ($it in $items) {
  if ($Archive) {
    $rel = $it.FullName.Substring($inbox.Length).TrimStart([IO.Path]::DirectorySeparatorChar)
    $dest = Join-Path $ArchiveRoot $rel
    $destDir = Split-Path $dest -Parent
    if (-not $DryRun) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    if ($DryRun) { Write-Host "Dry-run: would move $($it.FullName) -> $dest" } else { Move-Item -Path $it.FullName -Destination $dest -Force; Write-Host "Moved $($it.FullName) -> $dest" }
  } else {
    if ($DryRun) { Write-Host "Dry-run: would remove $($it.FullName)" } else { Remove-Item -Path $it.FullName -Force; Write-Host "Removed $($it.FullName)" }
  }
}

Write-Host "Done."
