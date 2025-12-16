# Opens the presenter HTML in the default browser, waits, and captures the foreground window to a PNG file
$index = 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\index.html'
if (-not (Test-Path $index)) { Write-Error "Presenter index not found: $index"; exit 1 }

# Open in default browser
$proc = Start-Process -FilePath $index -PassThru
Start-Sleep -Seconds 2

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

# Wait a bit for the browser window to be ready and try to locate it by window title
Start-Sleep -Seconds 1
$winProc = $null
for ($i = 0; $i -lt 12 -and -not $winProc; $i++) {
    $winProc = Get-Process | Where-Object { $_.MainWindowTitle -match 'NAVI|Mail Room|Presenter|index.html' } | Select-Object -First 1
    if (-not $winProc) { Start-Sleep -Milliseconds 500 }
}

if ($winProc) {
    $hWnd = $winProc.MainWindowHandle
    # Try to show and bring to front
    [Win32]::ShowWindowAsync($hWnd, 3) | Out-Null
    Start-Sleep -Milliseconds 300
    [Win32]::SetForegroundWindow($hWnd) | Out-Null

    # Get window rect
    try {
        $rect = New-Object Win32+RECT
        [Win32]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
        $width = $rect.Right - $rect.Left
        $height = $rect.Bottom - $rect.Top
        if ($width -le 0 -or $height -le 0) { throw 'Invalid window size' }
    } catch {
        Write-Warning "Window rect capture failed, falling back to full screen: $_"
        $winProc = $null
    }
}

# Fallback: capture full primary screen if window not found
if (-not $winProc) {
    Add-Type -AssemblyName System.Windows.Forms
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $rect = New-Object Win32+RECT
    $rect.Left = $screen.Left; $rect.Top = $screen.Top; $rect.Right = $screen.Right; $rect.Bottom = $screen.Bottom
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    Write-Warning "Falling back to full screen capture: ${width}x${height}"
}

# Capture screenshot
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)
$save = 'D:\Temp\navi_presenter_screenshot.png'
$bmp.Save($save, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bmp.Dispose()

Write-Output "Saved screenshot to: $save"
# Open the screenshot in default viewer
Start-Process -FilePath $save
