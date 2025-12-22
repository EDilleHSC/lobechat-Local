<#
Usage:
  .\collect_4688_events.ps1 -Start '2025-12-21 19:51:00' -End '2025-12-21 19:53:00' -OutFile ops\uvx-4688.log

This script extracts Security log events with ID 4688 in the time window and writes JSON-lines including TimeCreated and Message.
#>

Param(
  [Parameter(Mandatory=$true)] [datetime]$Start,
  [Parameter(Mandatory=$true)] [datetime]$End,
  [string]$OutFile = "ops\\uvx-4688.log"
)

Write-Output "Collecting Event ID 4688 from Security log between $Start and $End"
$filter = @{ LogName = 'Security'; Id = 4688; StartTime = $Start; EndTime = $End }
$events = Get-WinEvent -FilterHashtable $filter -ErrorAction Stop

if (-not $events) { Write-Output "No events found in the time window."; exit 0 }

$lines = foreach ($e in $events) {
  [PSCustomObject]@{
    TimeCreated = $e.TimeCreated.ToString("o")
    Id = $e.Id
    RecordId = $e.RecordId
    Message = ($e | Select-Object -ExpandProperty Message)
  } | ConvertTo-Json -Compress
}

$dir = Split-Path -Path $OutFile -Parent
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

$lines | Out-File -FilePath $OutFile -Encoding utf8 -Force
Write-Output "Wrote $(($lines).Count) events to $OutFile"
