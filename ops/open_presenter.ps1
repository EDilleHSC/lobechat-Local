# Create a Desktop shortcut to the NAVI Presenter and open the HTML in the default browser
$indexPath = 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\index.html'

if (-not (Test-Path $indexPath)) {
    Write-Error "Presenter index not found: $indexPath"
    exit 1
}

# Create desktop shortcut
$desktop = [Environment]::GetFolderPath('Desktop')
$WshShell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path $desktop 'NAVI Presenter.lnk'
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $indexPath
$shortcut.WorkingDirectory = Split-Path $indexPath -Parent
$shortcut.IconLocation = "C:\Windows\System32\ieframe.dll,0"
$shortcut.Description = "Open NAVI Mail Room Presenter"
$shortcut.Save()
Write-Output "Desktop shortcut created: $shortcutPath"

# Open index.html in default browser
Start-Process -FilePath $indexPath
Write-Output "Opened presenter: $indexPath"