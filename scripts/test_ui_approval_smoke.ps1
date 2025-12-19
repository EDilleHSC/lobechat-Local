param(
    [string]$Token = $env:MCP_APPROVAL_TOKEN
)
if (-not $Token) {
    Write-Error "MCP_APPROVAL_TOKEN not provided. Set env var or pass -Token"
    exit 2
}
$server = 'http://localhost:8005'
$payload = @{
    approvedBy = 'test-ui'
    date = (Get-Date).ToString('o')
    role = 'automation'
    notes = 'UI smoke test approval'
    checklist = @{ layout = $true; accessibility = $true; bugFixed = $false; production = $false }
    status = 'approved'
} | ConvertTo-Json -Depth 4
try {
    $res = Invoke-RestMethod -Uri "$server/approval" -Method POST -Body $payload -Headers @{ 'X-MCP-APPROVAL-TOKEN' = $Token } -ContentType 'application/json' -ErrorAction Stop
} catch {
    Write-Error "Approval POST failed: $($_.Exception.Message)"
    exit 3
}
if (-not $res.file) {
    Write-Error "Approval response missing 'file' field. Response: $($res | ConvertTo-Json -Depth 4)"
    exit 4
}
Write-Output "Approval persisted at: $($res.file)"
# Validate file exists
if (-not (Test-Path $res.file)) {
    Write-Error "Persisted approval file not found: $($res.file)"
    exit 5
}
# Validate audit log contains entry
$audit = Join-Path -Path "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\approvals" -ChildPath 'audit.log'
if (-not (Test-Path $audit)) {
    Write-Error "Audit log not found: $audit"
    exit 6
}
$last = Get-Content $audit -Tail 5 | Select-String -Pattern ([regex]::Escape([IO.Path]::GetFileName($res.file)))
if (-not $last) {
    Write-Error "Audit log does not reference the persisted approval file. tail of audit.log:`n$(Get-Content $audit -Tail 10 | Out-String)"
    exit 7
}
Write-Output 'TEST PASSED: UI approval persisted and audit logged'
exit 0