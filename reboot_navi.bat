@echo off
title NAVI Reboot Sequence
echo ========================================
echo      NAVI SYSTEM REBOOT INITIATED
echo ========================================
echo.

:: Timestamp log
set "LOGFILE=D:\05_AGENTS-AI\01_RUNTIME\VBoarder\ops\reboot_navi.log"
echo [%date% %time%] NAVI Reboot started >> "%LOGFILE%" 2>nul
echo.

:: Kill any existing node/python processes
echo Killing old NAVI processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
timeout /t 2 >nul
echo.

:: (Optional) Clean up log files if needed (uncomment to enable)



































pauseecho [%date% %time%] NAVI Reboot completed >> "%LOGFILE%" 2>nulecho.echo Check http://localhost:8005/presenter/index.html (or your configured MCP port)echo NAVI Reboot Triggered.echo.)    )        )            echo [%date% %time%] Presenter NOT started - no python available >> "%LOGFILE%" 2>nul            echo No usable Python found; presenter not started. Please install Python or update this script.        ) else (            echo [%date% %time%] Started presenter with py -3 >> "%LOGFILE%" 2>nul            start "Presenter" /min py -3 "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\presenter.py"        if %ERRORLEVEL%==0 (        where py >nul 2>&1    ) else (        echo [%date% %time%] Started presenter with python on PATH >> "%LOGFILE%" 2>nul        start "Presenter" /min python "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\presenter.py"    if %ERRORLEVEL%==0 (    where python >nul 2>&1) else (    echo [%date% %time%] Started presenter with C:\Python312\python.exe >> "%LOGFILE%" 2>nul    start "Presenter" /min "C:\Python312\python.exe" "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\presenter.py"if exist "C:\Python312\python.exe" (echo Launching Presenter UI (regenerates HTML)...:: Restart Presenter (Python) using available python runtimeecho [%date% %time%] MCP start triggered >> "%LOGFILE%" 2>nulstart "MCP" /min "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\start_mcp_server_persistent.bat"echo Launching MCP Server...:: Restart MCP server:: del /Q "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\server.log" "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\server_error.log"