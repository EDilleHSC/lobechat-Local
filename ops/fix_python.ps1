# fix_python.ps1
# Safe installer/repair for Python runtime used by NAVI
# - Uninstalls Microsoft Store Python if detected (via winget)
# - Installs official Python to C:\Python312 (system-wide)
# - Adds Python to PATH (installer option)
# - Verifies python availability and runs presenter.py to regenerate HTML

$ErrorActionPreference = 'Stop'

$LogDir = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\ops"
if (-not (Test-Path $LogDir)) { New-Item -Path $LogDir -ItemType Directory -Force | Out-Null }
$LogFile = Join-Path $LogDir "fix_python.log"
function Log { param($m) $ts = (Get-Date).ToString('s'); Add-Content -Path $LogFile -Value "[$ts] $m"; Write-Host $m }

# Ensure running as administrator
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Log "Script not running as admin. Relaunching as administrator..."
    Start-Process -FilePath pwsh -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Log "Starting fix_python.ps1"

# 1) Quick check: is python already usable?
try {
    $pyCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pyCmd) {
        Log "Python found on PATH: $($pyCmd.Source). Verifying version..."
        $v = (& python --version) 2>&1
        Log "python --version: $v"
        Log "Python appears usable; running presenter to refresh HTML..."
        Push-Location "D:\05_AGENTS-AI\01_RUNTIME\VBoarder"
        try { & python .\presenter.py; Log "Presenter run completed." } catch { Log ("Presenter run failed: {0}" -f $_) }
        Pop-Location
        Log "Done."
        exit 0
    }
} catch {
    Log ("Error checking python: {0}" -f $_)
}

# 2) Detect Microsoft Store WindowsApps Python installations
$waPython = $null
try {
    $waMatches = Get-ChildItem 'C:\Program Files\WindowsApps' -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'PythonSoftwareFoundation.Python*' }
    if ($waMatches -and $waMatches.Count -gt 0) {
        $waPython = $waMatches[0].FullName
        Log "Detected WindowsApps Python: $($waMatches[0].Name)"
    } else {
        Log "No WindowsApps python detected by directory check."
    }
} catch {
    Log ("Error scanning WindowsApps: {0}" -f $_)
}

# 3) Uninstall Store Python via winget if found
$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($waPython -and $winget) {
    Log "Attempting to uninstall Store Python using winget..."
    try {
        $uninstall = & winget uninstall --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements 2>&1
        Log "winget uninstall output: $uninstall"
    } catch {
        Log ("winget uninstall failed: {0}" -f $_)
    }
} elseif ($waPython) {
    Log "WindowsApps Python detected but winget not found. You may need to uninstall via Settings > Apps or remove package manually."
}

# 4) Download official Python installer
$InstallerUrl = 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe'
$Tmp = Join-Path $env:TEMP 'python-3.12.10-amd64.exe'
if (-not (Test-Path $Tmp)) {
    Log "Downloading Python installer to $Tmp"
    try {
        Invoke-WebRequest -Uri $InstallerUrl -OutFile $Tmp -UseBasicParsing -Verbose -ErrorAction Stop
        Log "Downloaded installer"
    } catch {
        Log ("Failed to download installer: {0}" -f $_)
        exit 1
    }
} else {
    Log "Installer already exists at $Tmp, skipping download."
}

# 5) Run installer silently for all users and add to PATH
Log "Running installer (this may take a minute)..."
try {
    $args = '/quiet','InstallAllUsers=1','PrependPath=1','Include_test=0','TargetDir="C:\Python312"'
    $proc = Start-Process -FilePath $Tmp -ArgumentList $args -Wait -PassThru
    Log "Installer exit code: $($proc.ExitCode)"
} catch {
    Log ("Installer failed: {0}" -f $_)
    exit 1
}

Start-Sleep -Seconds 2

# 6) Verify installation
$pythonPaths = @(
    'C:\Python312\python.exe',
    'C:\Program Files\Python312\python.exe'
)
$found = $false
foreach ($p in $pythonPaths) {
    if (Test-Path $p) {
        Log "Found python at $p"
        try { $ver = & "$p" --version 2>&1; Log "Version: $ver" } catch { Log ("Failed to run {0}: {1}" -f $p, $_) }
        $found = $true
        $pyExec = $p
        break
    }
}

if (-not $found) {
    # Maybe it's on PATH now
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) {
        Log "python discovered on PATH via Get-Command: $($cmd.Source)"
        $pyExec = $cmd.Source
        $found = $true
    }
}

if (-not $found) {
    Log "Installation appears to have failed or python is not discoverable. Please check installer output and PATH."
    exit 1
}

# 7) Regenerate presenter HTML
Log "Running presenter with $pyExec to regenerate HTML"
try {
    Push-Location "D:\05_AGENTS-AI\01_RUNTIME\VBoarder"
    & "$pyExec" .\presenter.py 2>&1 | ForEach-Object { Log "[presenter] $_" }
    Pop-Location
    Log "Presenter run finished"
} catch {
    Log ("Presenter run failed: {0}" -f $_)
}

# 8) Final checks
try {
    $where = (& where python) 2>&1
    Log "where python: $where"
    $v = (& python --version) 2>&1
    Log "Final python --version: $v"
} catch {
    Log ("Final verification failed: {0}" -f $_)
}

Log "fix_python.ps1 finished"
exit 0
