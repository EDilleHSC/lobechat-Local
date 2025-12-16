$html = 'file:///D:/05_AGENTS-AI/01_RUNTIME/VBoarder/NAVI/presenter/index_debug_probe.html'
$p = Start-Process -FilePath "$env:windir\system32\mshta.exe" -ArgumentList "$html" -PassThru
$tries = 0
while (($p -and $p.MainWindowHandle -eq 0) -and ($tries -lt 50)) {
    Start-Sleep -Milliseconds 200
    $p.Refresh()
    $tries++
}
if ($p -and $p.MainWindowHandle -ne 0) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
    [Win]::ShowWindow($p.MainWindowHandle,9) | Out-Null
    [Win]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
    Write-Host '✓ mshta window focused'
} else {
    Write-Host '✗ mshta window not found; will proceed to full-screen capture fallback'
}
Start-Sleep -Seconds 1
D:\05_AGENTS-AI\01_RUNTIME\VBoarder\ops\capture_presenter_screenshot.ps1
