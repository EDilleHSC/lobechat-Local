param(
    [string]$ApprovalPath
)

if (-not $ApprovalPath) {
    Write-Host "Usage: .\apply_approval.ps1 -ApprovalPath <path to approval.json>"
    exit 1
}

if (-not (Test-Path $ApprovalPath)) {
    Write-Host "Approval file not found: $ApprovalPath"
    exit 1
}

$approval = Get-Content $ApprovalPath | ConvertFrom-Json
$snapshotId = $approval.snapshot_id
$items = $approval.items

$inboxDir = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\inbox"
$baseDir = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"

$logPath = $ApprovalPath -replace '\.approval\.json$', '_apply.log'
$log = @()

foreach ($item in $items) {
    $filename = $item.filename
    $outcome = $item.gtd_outcome
    $sensitivity = $item.sensitivity

    $subfolder = switch ($outcome) {
        'approved' {
            if ($sensitivity -eq 'normal') { 'processed' } else { 'escalated' }
        }
        'rejected' { 'rejected' }
        'escalated' { 'escalated' }
        default { 'processed' }
    }

    $destDir = Join-Path $baseDir $subfolder $snapshotId
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    $src = Join-Path $inboxDir $filename
    $dest = Join-Path $destDir $filename

    if (Test-Path $src) {
        Move-Item $src $dest
        $log += "MOVED: $filename -> $subfolder/$snapshotId/"
    } else {
        $log += "MISSING: $filename not found in inbox"
    }
}

$log | Out-File $logPath -Encoding UTF8
Write-Host "Apply complete. Log: $logPath"