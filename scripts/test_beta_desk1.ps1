<#
Deterministic acceptance test for Desk v1 approval + audit loop
- Starts the server (if not running) with MCP_APPROVAL_TOKEN set in the same process
- Drops a sample file into NAVI/inbox
- Triggers POST /process
- Finds the latest snapshot produced
- Submits an approval referring to that snapshot
- Asserts: approval file exists and audit.log contains the approvedBy entry

Usage:
    .\scripts\test_beta_desk1.ps1 -Token TEST_APPROVAL

Exits non-zero on any failed assertion.
#>

param(
    [int]$Port = 8005,
    [string]$Token = '',
    [int]$WaitSeconds = 30,
    [switch]$NoCleanup
)

$ErrorActionPreference = 'Stop'

# Enforce repo root
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Resolve-Path "$ScriptRoot\..")
Write-Host "Working directory: $(Get-Location)"

# Token resolution
if (-not $Token -and -not $env:MCP_APPROVAL_TOKEN) {
    Write-Error "MCP_APPROVAL_TOKEN not provided (pass -Token or set env var). Aborting."
    exit 2
}
if ($Token) { $env:MCP_APPROVAL_TOKEN = $Token; Write-Host "Using token from parameter" }
else { Write-Host "Using token from environment" }

# Server file check
if (-not (Test-Path 'runtime/triage_20251216_172245/mcp_server.js')) {
    Write-Error "mcp_server.js not found at runtime/triage_20251216_172245/mcp_server.js. Are you running from the repo root?"
    exit 1
}

function Check-Health { try { $h = Invoke-RestMethod -Uri "http://localhost:$Port/health" -Method Get -TimeoutSec 3; return $true } catch { return $false } }

$serverStarted = $false
$proc = $null
if (-not (Check-Health)) {
    Write-Host "Server not running: starting MCP server with token in this process..."
    if (-not (Test-Path 'NAVI\logs')) { New-Item -ItemType Directory -Path 'NAVI\logs' | Out-Null }
    $out = Join-Path 'NAVI\logs' "mcp_server-test_beta_desk1.out.log"
    $err = Join-Path 'NAVI\logs' "mcp_server-test_beta_desk1.err.log"
    $proc = Start-Process -FilePath node -ArgumentList 'runtime/triage_20251216_172245/mcp_server.js' -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
    Write-Host "Started node PID $($proc.Id)"
    $serverStarted = $true

    $attempt = 0
    while ($attempt -lt $WaitSeconds) {
        if (Check-Health) { Write-Host "/health OK"; break }
        Start-Sleep -Seconds 1; $attempt++
    }
    if (-not (Check-Health)) { Write-Error "Server did not become healthy in $WaitSeconds seconds. See $out and $err"; exit 3 }
} else {
    Write-Host "Server already running and healthy at http://localhost:$Port"
}

# Drop sample file into inbox
$inbox = 'NAVI\inbox'
if (-not (Test-Path $inbox)) { New-Item -ItemType Directory -Path $inbox | Out-Null }
$sampleFile = Join-Path $inbox "test_beta_desk1-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
Set-Content -Path $sampleFile -Value "beta day0 test" -Encoding UTF8
Write-Host "Wrote sample file: $sampleFile"

# Trigger /process
Write-Host "Triggering /process..."
try {
    $procRes = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/process" -TimeoutSec 60
    Write-Host "Process response: $($procRes | ConvertTo-Json -Depth 2)"
} catch { Write-Error "/process failed: $($_.Exception.Message)"; exit 4 }

# Find latest snapshot
Start-Sleep -Seconds 1
$snap = Get-ChildItem -Path 'NAVI\snapshots\inbox' -Filter '*.json' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $snap) { Write-Error "No snapshot found in NAVI/snapshots/inbox"; exit 5 }
$snapName = $snap.Name
Write-Host "Found snapshot: $snapName"

# Submit approval
$headers = @{ 'x-mcp-approval-token' = $env:MCP_APPROVAL_TOKEN }
$payload = @{ approvedBy = 'test-beta-desk1'; status = 'approved'; checklist = @{ layout = $true; accessibility = $true; bugFixed = $false; production = $false }; date = (Get-Date).ToString('o'); notes = "snapshot_id: $snapName; files: ['$(Split-Path -Leaf $sampleFile)']" }
$json = $payload | ConvertTo-Json -Compress -Depth 5
Write-Host "Submitting approval..."
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:$Port/approval" -Method Post -Body $json -ContentType 'application/json' -Headers $headers -TimeoutSec 10
    Write-Host "Approval response: $($resp | ConvertTo-Json -Depth 3)"
} catch {
    Write-Error "Approval POST failed: $($_.Exception.Response.Content.ReadAsStringAsync().Result)"; exit 6
}

# Verify persisted file exists
$apprFile = $resp.file
if (-not (Test-Path $apprFile)) { Write-Error "Approval file reported but not found: $apprFile"; exit 7 }
Write-Host "Approval file exists: $apprFile"

# Verify audit.log contains entry
$auditPath = 'NAVI\approvals\audit.log'
if (-not (Test-Path $auditPath)) { Write-Error "audit.log not found"; exit 8 }
$tail = Get-Content $auditPath -Tail 5
$found = $tail -join "`n" | Select-String -SimpleMatch 'test-beta-desk1'
if (-not $found) { Write-Error "audit.log does not contain 'test-beta-desk1' in last lines"; exit 9 }
Write-Host "audit.log updated (recent lines):`n$tail"

# Cleanup (remove sample file)
if (-not $NoCleanup) {
    Remove-Item -Path $sampleFile -Force -ErrorAction SilentlyContinue
    Write-Host "Removed sample file"
}

# If we started the server, stop it
if ($serverStarted -and $proc) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; Write-Host "Stopped server PID $($proc.Id)" } catch { }
}

Write-Host "TEST PASSED: approval persisted and audit logged"
exit 0
