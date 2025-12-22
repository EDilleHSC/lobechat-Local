# Tails the uvx-shim.log and attempts to enrich each invocation with process metadata.
# Run as: PowerShell -NoProfile -ExecutionPolicy Bypass -File .\uvx_watch_and_enrich.ps1
# Or start as a background job: Start-Job -FilePath .\uvx_watch_and_enrich.ps1

$ScriptPath = $MyInvocation.MyCommand.Path
if (-not $ScriptPath) { $ScriptPath = $PSCommandPath }
if (-not $ScriptPath) { $ScriptPath = $MyInvocation.MyCommand.Definition }
# Guard against cases where the 'Definition' contains the script body (starts with comments) instead of a path
if ($ScriptPath -and ($ScriptPath -match '^[\s#]' -or $ScriptPath -match "\r?\n")) { $ScriptPath = $null }
if (-not $ScriptPath) { $ScriptPath = $PSCommandPath }
if (-not $ScriptPath) { $ScriptPath = $PSScriptRoot }
$ScriptRoot = if ($ScriptPath) { Split-Path -Parent $ScriptPath } else { $PSScriptRoot }
if (-not $ScriptRoot) { Write-Error "Unable to determine script directory; exiting"; exit 1 }
$LogFile = Join-Path -Path $ScriptRoot -ChildPath "..\logs\uvx-shim.log" | Resolve-Path -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -ErrorAction SilentlyContinue
if (-not $LogFile) { $LogFile = Join-Path -Path $ScriptRoot -ChildPath "..\logs\uvx-shim.log" }
$OutFile = Join-Path -Path $ScriptRoot -ChildPath "uvx-diagnostics.log"

Write-Output "Starting uvx watch and enrich. Logging to $OutFile"

# Ensure output file exists
if (-not (Test-Path $OutFile)) { New-Item -Path $OutFile -ItemType File -Force | Out-Null }

# Wait for uvx log file to exist
while (-not (Test-Path $LogFile)) { Write-Output "Waiting for uvx log at $LogFile"; Start-Sleep -Seconds 1 }

# Tail the log and process new lines as they appear
Get-Content -Path $LogFile -Wait -Tail 0 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    try {
        $entry = $line | ConvertFrom-Json
    } catch {
        Write-Warning "Failed to parse JSON line: $_"
        return
    }

    $ppid = $entry.ppid
    $enriched = @{ timestamp = $entry.timestamp; pid = $entry.pid; ppid = $ppid; args = $entry.args; cwd = $entry.cwd; env = $entry.env; noticedAt = (Get-Date).ToString('o') }

    # Try to resolve the parent process immediately
    try {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId=$ppid" -ErrorAction SilentlyContinue
        if ($null -ne $p) {
            $owner = $p | Invoke-CimMethod -MethodName GetOwner -ErrorAction SilentlyContinue
            $enriched.Parent = @{ ProcessId = $p.ProcessId; Name = $p.Name; CommandLine = $p.CommandLine; ExecutablePath = $p.ExecutablePath; ParentProcessId = $p.ParentProcessId; Owner = @{ User = $owner.User; Domain = $owner.Domain } }
        } else {
            $enriched.Parent = $null
        }
    } catch {
        $enriched.Parent = $null
    }

    # Append to diagnostics log (json-lines)
    $outLine = ( $enriched | ConvertTo-Json -Compress )
    Add-Content -Path $OutFile -Value $outLine
    Write-Output "Enriched uvx entry: $outLine"
}
