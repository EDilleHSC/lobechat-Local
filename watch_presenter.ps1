$target = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\index.html"

if (!(Test-Path $target)) {
    Write-Host "Target file not found: $target"
    exit 1
}

$last = (Get-Item $target).LastWriteTime
Write-Host "Watching $target"
Write-Host "Last modified: $last"
Write-Host "Waiting for change..."

while ($true) {
    Start-Sleep -Milliseconds 500
    $now = (Get-Item $target).LastWriteTime
    if ($now -ne $last) {
        $last = $now
        $ts = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
        Write-Host "CHANGE DETECTED at $now"
        Write-Host "Capturing process snapshot..."

        Get-CimInstance Win32_Process |
            Select-Object ProcessId, Name, ParentProcessId,
                @{N="CommandLine";E={$_.CommandLine}} |
            Sort-Object Name |
            Out-File -FilePath "presenter_writer_snapshot_$ts.txt" -Width 300

        Write-Host "Snapshot written to presenter_writer_snapshot_$ts.txt"
        break
    }
}