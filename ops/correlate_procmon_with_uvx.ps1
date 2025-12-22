<#
Script: correlate_procmon_with_uvx.ps1
Purpose: Parse ProcMon CSV (Process Create rows) and correlate Process Create events with uvx shim logs.
Usage:
  .\correlate_procmon_with_uvx.ps1 -ProcmonCsv ./uvx-parent-trace.csv -UvXLog logs/uvx-shim.log -TraceLog logs/uvx-parent-trace.log -WindowSeconds 5 -OutFile ops/uvx-correlated.jsonl

Notes:
 - ProcMon CSV exported from ProcMon should include columns: "Time of Day" (or "Date/Time"), "Process Name", "Operation", "Detail" (and PID columns). Use CSV export if possible.
 - The script will search Process Create rows for uvx/node and extract details via regex.
 - Output: JSON-lines file where each line contains the ProcMon event and any uvx-shim entries within ±WindowSeconds.
#>

param(
  [Parameter(Mandatory=$true)][string]$ProcmonCsv,
  [Parameter(Mandatory=$true)][string]$UvXLog,
  [Parameter(Mandatory=$false)][string]$TraceLog = "logs\\uvx-parent-trace.log",
  [int]$WindowSeconds = 5,
  [string]$OutFile = "ops\\uvx-correlated.jsonl"
)

function Parse-ProcmonTime($timeStr) {
  # ProcMon CSV may emit "Time of Day" in various formats. Try several parse attempts.
  $formats = @("yyyy-MM-dd HH:mm:ss.fffffff","MM/dd/yyyy hh:mm:ss.fff tt","HH:mm:ss.fff","o")
  foreach ($fmt in $formats) {
    try { return [datetime]::ParseExact($timeStr, $fmt, $null) } catch { }
  }
  try { return [datetime]::Parse($timeStr) } catch { return $null }
}

if (-not (Test-Path $ProcmonCsv)) { Write-Error "ProcMon CSV not found: $ProcmonCsv"; exit 1 }
if (-not (Test-Path $UvXLog)) { Write-Error "uvx-shim log not found: $UvXLog"; exit 1 }

Write-Output "Loading ProcMon CSV: $ProcmonCsv"
$csv = Import-Csv -Path $ProcmonCsv -ErrorAction Stop

# Find the likely timestamp/operation/process columns
$colNames = $csv[0].psobject.properties.name
$timeCol = ($colNames | Where-Object { $_ -match 'Time|Date' }) | Select-Object -First 1
$processCol = ($colNames | Where-Object { $_ -match 'Process' }) | Select-Object -First 1
$opCol = ($colNames | Where-Object { $_ -match 'Operation' }) | Select-Object -First 1
$detailCol = ($colNames | Where-Object { $_ -match 'Detail|Path' }) | Select-Object -First 1

if (-not $timeCol -or -not $processCol -or -not $opCol) { Write-Error "Could not auto-detect required columns in CSV. Columns found: $($colNames -join ', ')"; exit 1 }
Write-Output "Detected columns: Time='$timeCol' Process='$processCol' Operation='$opCol' Detail='$detailCol'"

# Load uvx logs into memory
$uvxEntries = Get-Content $UvXLog | Where-Object { $_.Trim() } | ForEach-Object {
  try { ConvertFrom-Json $_ } catch { $null }
} | Where-Object { $_ -ne $null }

# parse trace log optionally
$traceEntries = @()
if (Test-Path $TraceLog) {
  $traceEntries = Get-Content $TraceLog | Where-Object { $_.Trim() } | ForEach-Object {
    try { ConvertFrom-Json $_ } catch { $null }
  } | Where-Object { $_ -ne $null }
}

$outDir = Split-Path $OutFile -Parent
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$matches = @()

foreach ($row in $csv) {
  $op = $row.$opCol
  if ($op -ne 'Process Create') { continue }

  $procName = $row.$processCol
  if (-not ($procName -match 'uvx|node')) { continue }

  $timeVal = $row.$timeCol
  $ts = Parse-ProcmonTime $timeVal
  if (-not $ts) { continue }

  $detail = ''
  if ($detailCol) { $detail = $row.$detailCol }

  # Extract fields from Detail when possible
  $newProcName = $null; $cmdLine = $null; $curDir = $null; $parentPID = $null; $parentProc = $null; $imagePath = $null

  if ($detail) {
    # Attempt a few regexes to get command line and parent info
    $m = [regex]::Match($detail, 'New Process Name: (?<np>[^,]+)')
    if ($m.Success) { $newProcName = $m.Groups['np'].Value.Trim() }
    $m = [regex]::Match($detail, 'Command line: (?<cl>[^,]+)')
    if ($m.Success) { $cmdLine = $m.Groups['cl'].Value.Trim() }
    $m = [regex]::Match($detail, 'Current Directory: (?<cd>[^,]+)')
    if ($m.Success) { $curDir = $m.Groups['cd'].Value.Trim() }
    $m = [regex]::Match($detail, 'Parent PID: (?<ppid>\d+)')
    if ($m.Success) { $parentPID = [int]$m.Groups['ppid'].Value }
    $m = [regex]::Match($detail, 'Parent Process: (?<pp>[^,]+)')
    if ($m.Success) { $parentProc = $m.Groups['pp'].Value.Trim() }
    $m = [regex]::Match($detail, 'Image File: (?<img>[^,]+)')
    if ($m.Success) { $imagePath = $m.Groups['img'].Value.Trim() }
  }

  $matchObj = [PSCustomObject]@{
    ProcmonTime = $ts.ToString('o')
    ProcessName = $procName
    NewProcessName = $newProcName
    CommandLine = $cmdLine
    CurrentDirectory = $curDir
    ParentPID = $parentPID
    ParentProcess = $parentProc
    ImagePath = $imagePath
    RawDetail = $detail
    ProcmonRow = $row
    NearbyUvX = @()
    NearbyTrace = @()
  }

  # find uvx-shim log entries within window
  $windowStart = $ts.AddSeconds(-1 * $WindowSeconds)
  $windowEnd = $ts.AddSeconds($WindowSeconds)
  $near = $uvxEntries | Where-Object { 
    try { 
      $t = [datetime]::Parse($_.timestamp); $t -ge $windowStart -and $t -le $windowEnd
    } catch { $false }
  }
  foreach ($n in $near) { $matchObj.NearbyUvX += $n }

  # find trace log entries within window
  $nearT = $traceEntries | Where-Object { 
    try { 
      $t = [datetime]::Parse($_.timestamp); $t -ge $windowStart -and $t -le $windowEnd
    } catch { $false }
  }
  foreach ($n in $nearT) { $matchObj.NearbyTrace += $n }

  # write a JSON line
  $json = $matchObj | ConvertTo-Json -Compress
  Add-Content -Path $OutFile -Value $json -Encoding utf8
  $matches += $matchObj
}

Write-Output "Wrote $($matches.Count) correlated items to $OutFile"
If ($matches.Count -eq 0) { Write-Output "No ProcMon process-create matches found for uvx/node in CSV." }
