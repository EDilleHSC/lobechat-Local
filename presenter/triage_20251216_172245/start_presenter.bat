@echo off
echo Starting presenter once (regenerates index.html)
if exist "C:\Python312\python.exe" (
    "C:\Python312\python.exe" "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\presenter.py"
    exit /b %ERRORLEVEL%
)
where python >nul 2>&1
if %ERRORLEVEL%==0 (
    python "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\presenter.py"
    exit /b %ERRORLEVEL%
)
where py >nul 2>&1
if %ERRORLEVEL%==0 (
    py -3 "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\presenter.py"
    exit /b %ERRORLEVEL%
)

echo No usable Python found. Please install Python or edit this script.
exit /b 1
