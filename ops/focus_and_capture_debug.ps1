Start-Process -FilePath 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\index_debug_probe.html'
Start-Sleep -Seconds 2
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
$found = $null
[Win]::EnumWindows({ param($h,$l) 
    if([Win]::IsWindowVisible($h)) {
        $len = [Win]::GetWindowTextLength($h)
        if($len -gt 0) {
            $sb = New-Object System.Text.StringBuilder ($len+1)
            [Win]::GetWindowText($h,$sb,$sb.Capacity) | Out-Null
            $title = $sb.ToString()
            if($title -like '*NAVI Debug Probe*' -or $title -like '*Debug Probe*' -or $title -like '*index_debug_probe.html*') {
                $found = $h
                return $false
            }
        }
    }
    return $true
}) | Out-Null

if($found -ne $null) {
    [Win]::ShowWindow($found,9) | Out-Null
    [Win]::SetForegroundWindow($found) | Out-Null
    Start-Sleep -Milliseconds 400
    Write-Host '✓ Focused debug window'
} else {
    Write-Host '✗ Debug window not found'
}

Start-Sleep -Seconds 1
# call existing capture script
D:\05_AGENTS-AI\01_RUNTIME\VBoarder\ops\capture_presenter_screenshot.ps1
