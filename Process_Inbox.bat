@echo off
REM Process_Inbox.bat — canonical entrypoint shim for running mailroom runner
REM Usage: double-click or run from repo root: Process_Inbox.bat

setlocal enableextensions enabledelayedexpansion
set REPO_ROOT=%~dp0
set TARGET=%REPO_ROOT%runtime\mailroom_runner.py

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  python "%TARGET%" %*
  exit /b %ERRORLEVEL%
) else (
  if exist "D:\Python312\python.exe" (
    "D:\Python312\python.exe" "%TARGET%" %*
    exit /b %ERRORLEVEL%
  ) else (
    echo ERROR: python not found in PATH and D:\Python312\python.exe not present.
    exit /b 1
  )
)