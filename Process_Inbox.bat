@echo off
rem Compatibility shim — forwards to pipelines triage Process_Inbox
call "pipelines\triage_20251216_172245\Process_Inbox.bat" %*

echo [INFO] Found files in inbox. Starting NAVI processing...
echo.

echo [INFO] Sending processing request to NAVI server...
curl -X POST http://localhost:8005/process ^
  -H "Accept: application/json" ^
  -H "Content-Type: application/json" ^
  -d "{}" >nul 2>&1

if %errorlevel% equ 0 (
    echo [SUCCESS] Processing request sent successfully.
) else (
    echo [ERROR] Failed to send processing request.
    echo Check if NAVI servers are running.
    echo.
    pause
    exit /b 1
)

echo.
echo [INFO] Processing may take a few moments...
echo Files will move from inbox → ACTIVE → WAITING or DONE
echo.

echo [INFO] Opening NAVI summary for results...
notepad "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter_output.txt"

echo.
echo ========================================
echo [SUCCESS] PROCESSING COMPLETE
echo ========================================
echo Next steps:
echo - Check NAVI\WAITING for files needing decisions
echo - Check NAVI\DONE for completed processing
echo - Run again for more files
echo.
echo Press any key to close...
pause >nul