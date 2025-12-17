$desktop = [Environment]::GetFolderPath('Desktop')
$target = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\index.html"
$link = Join-Path $desktop "Clara.url"
$content = "[InternetShortcut]`r`nURL=file:///$target`r`nIconIndex=0`r`n" 
Set-Content -Path $link -Value $content -Encoding ASCII
Write-Host "Created Clara shortcut at: $link"