@echo off
REM Process_Inbox.bat — canonical entrypoint shim for running mailroom runner
REM Usage: double-click or run from repo root: Process_Inbox.bat

setlocal enableextensions enabledelayedexpansion
set REPO_ROOT=%~dp0
set CANON1=%REPO_ROOT%core\intake\pipelines\triage_20251216_172245\mailroom_runner.py
set CANON2=%REPO_ROOT%pipelines\triage_20251216_172245\mailroom_runner.py

  set TARGET=%CANON1%
) else if exist "%CANON2%" (5/process ^
  set TARGET=%CANON2%
) else ( application/json" ^
  echo ERROR: Mailroom runner not found at expected locations:  -d "{}" >nul 2>&1
  echo   %CANON1%
  echo   %CANON2%
  exit /b 1 [SUCCESS] Processing request sent successfully.
)

where python >nul 2>nuler system 'python' in PATH, otherwise fallback to known installrequest.
if %ERRORLEVEL%==0 (Check if NAVI servers are running.
  python "%TARGET%" %*
  exit /b %ERRORLEVEL%   pause
) else (    exit /b 1
  if exist "D:\\Python312\\python.exe" (
    "D:\\Python312\\python.exe" "%TARGET%" %*
    exit /b %ERRORLEVEL%ara presenter when processing completes successfully
  ) else (
    echo ERROR: python not found in PATH and D:\Python312\python.exe not present....
    exit /b 1te_clara.py" >nul 2>&1
  )   echo [INFO] Opening Clara (presenter)...
)    start "Clara" "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\clara.html"
endlocalecho Press any key to close...
pause >nul