Param([switch]$SpecialNow)

$failed = $false
$Base = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\ops\nightly"
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$dir = Join-Path $Base $ts
New-Item -Path $dir -ItemType Directory -Force | Out-Null
$log = Join-Path $dir "scan.log"

function Log($msg){
    $t = Get-Date -Format o
    "$t $msg" | Tee-Object -FilePath $log -Append
}

Log "Starting nightly scan. SpecialNow=$SpecialNow"
# 1) Run status monitor (python)
try {
    Log "Running status_monitor.py"
    if (Test-Path "D:\Python312\python.exe") {
        & "D:\Python312\python.exe" "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\status_monitor.py" *> (Join-Path $dir "status_monitor.log")
    } else {
        & python "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\status_monitor.py" *> (Join-Path $dir "status_monitor.log")
    }
    Log "status_monitor completed"
} catch {
    Log "status_monitor failed: $($_.Exception.Message)"
    $failed = $true
}

# 2) MCP health
try {
    Log "Checking MCP /health"
    $health = Invoke-RestMethod -Uri "http://localhost:8005/health" -UseBasicParsing -ErrorAction Stop
    $health | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $dir "mcp_health.json")
    Log "MCP health OK"
} catch {
    Log "MCP health check failed: $($_.Exception.Message)"
    $failed = $true
}

# 3) Run root guard
try {
    Log "Running root guard script"
    if (Test-Path "D:\Python312\python.exe") {
        & "D:\Python312\python.exe" "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\scripts\check_root_guard.py" *> (Join-Path $dir "root_guard.log")
    } else {
        & python "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\scripts\check_root_guard.py" *> (Join-Path $dir "root_guard.log")
    }
    Log "root guard completed"
} catch {
    Log "root guard failed: $($_.Exception.Message)"
    $failed = $true
}

# 4) NAVI directory counts
try {
    Log "Gathering NAVI counts"
    $navi = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"
    $folders = @("inbox","ACTIVE","WAITING","DONE","snapshots")
    foreach ($f in $folders) {
        $p = Join-Path $navi $f
        if (Test-Path $p) {
            $c = (Get-ChildItem -Path $p -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
        } else {
            $c = "MISSING"
        }
        ($f + ": " + $c) | Out-File -FilePath (Join-Path $dir "navi_counts.txt") -Append
    }
    Log "NAVI counts written"
} catch {
    Log "NAVI counts failed: $($_.Exception.Message)"
    $failed = $true
}

# 5) Disk usage
try {
    Log "Capturing disk usage"
    Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{n='FreeGB';e={[math]::Round($_.Free/1GB,2)}}, @{n='UsedGB';e={[math]::Round(($_.Used)/1GB,2)}} | ConvertTo-Json | Out-File (Join-Path $dir "disk.json")
    Log "Disk info captured"
} catch {
    Log "Disk info failed: $($_.Exception.Message)"
    $failed = $true
}

if ($failed) {
    Log "One or more checks failed — writing FAIL.flag and summary"
    New-Item -Path (Join-Path $dir "FAIL.flag") -ItemType File -Force | Out-Null
    # Create a small fail summary from logs
    $patterns = 'failed','MISSING','ERROR'
    $summary = Join-Path $dir "fail_summary.txt"
    @() | Out-File $summary
    Get-ChildItem -Path $dir -Filter '*.log' | ForEach-Object {
        Select-String -Path $_.FullName -Pattern $patterns -SimpleMatch | ForEach-Object { $_.Line } | Out-File -FilePath $summary -Append
    }
    Log "Fail summary written"
}

Log "Nightly scan complete. Logs stored to: $dir"

# Optional: compress results (leave as files for now)

Exit 0
