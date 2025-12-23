@echo off
REM Lightweight uvx shim wrapper - calls node script in repo bin
SET SCRIPT_DIR=%~dp0
node "%SCRIPT_DIR%uvx.js" %*
EXIT /B %ERRORLEVEL%
