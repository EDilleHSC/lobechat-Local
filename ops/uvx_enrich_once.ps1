# One-shot enricher for existing uvx-shim.log lines (useful for testing)
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path -Path $ScriptRoot -ChildPath "..\logs\uvx-shim.log" | Resolve-Path -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -ErrorAction SilentlyContinue
if (-not $LogFile) { $LogFile = Join-Path -Path $ScriptRoot -ChildPath "..\logs\uvx-shim.log" }
$OutFile = Join-Path -Path $ScriptRoot -ChildPath "uvx-diagnostics.log"

if (-not (Test-Path $LogFile)) { Write-Error "uvx log not found at $LogFile"; exit 1 }

Get-Content -Path $LogFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    try { $entry = $line | ConvertFrom-Json } catch { Write-Warning "Failed to parse: $_"; return }
    $ppid = $entry.ppid
    $enriched = @{ timestamp = $entry.timestamp; pid = $entry.pid; ppid = $ppid; args = $entry.args; cwd = $entry.cwd; env = $entry.env; noticedAt = (Get-Date).ToString('o') }
    try {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId=$ppid" -ErrorAction SilentlyContinue
        if ($null -ne $p) {
            $owner = $p | Invoke-CimMethod -MethodName GetOwner -ErrorAction SilentlyContinue
            $enriched.Parent = @{ ProcessId = $p.ProcessId; Name = $p.Name; CommandLine = $p.CommandLine; ExecutablePath = $p.ExecutablePath; ParentProcessId = $p.ParentProcessId; Owner = @{ User = $owner.User; Domain = $owner.Domain } }
        } else { $enriched.Parent = $null }
    } catch { $enriched.Parent = $null }
    Add-Content -Path $OutFile -Value ( $enriched | ConvertTo-Json -Compress )
    Write-Output "Enriched uvx entry: $($enriched | ConvertTo-Json -Compress)"
}
