@echo off
:: Fancy NAVI Reboot Script with Logging and Fail Detection
setlocal EnableDelayedExpansion

:: ==== CONFIG ====
set "BASE_DIR=D:\05_AGENTS-AI\01_RUNTIME\VBoarder"
set "LOGFILE=%BASE_DIR%\logs\reboot_log.txt"
set "PRESENTER_SCRIPT=%BASE_DIR%\presenter.py"
set "PYTHON_PATH=C:\Python312\python.exe"
set "MCP_START_BAT=%BASE_DIR%\start_mcp_server_persistent.bat"
set "TIMESTAMP=%DATE% %TIME%"
set "LINE=------------------------------------------------------------"

:: Ensure logs folder exists
if not exist "%BASE_DIR%\logs" (
    mkdir "%BASE_DIR%\logs"
)

:: ==== COLOR ECHO (uses PowerShell Write-Host when available) ====
:: %1 = color number, %2 = message
:colorEcho
set "_c=%~1"
set "_m=%~2"
if "%_c%"=="0" set "_cn=Black"
if "%_c%"=="1" set "_cn=Blue"
if "%_c%"=="2" set "_cn=Green"
if "%_c%"=="3" set "_cn=Cyan"
if "%_c%"=="4" set "_cn=Red"
if "%_c%"=="6" set "_cn=Yellow"
if "%_c%"=="7" set "_cn=White"
where powershell >nul 2>&1
if %ERRORLEVEL%==0 (
    powershell -NoProfile -Command "Write-Host '%_m%' -ForegroundColor %_cn%"
) else (
    echo %_m%
)
goto :eof

:: ==== HEADER ====
call :colorEcho 7 "%LINE%"
call :colorEcho 3 "  NAVI SYSTEM REBOOT INITIATED  [%TIMESTAMP%]"
call :colorEcho 7 "%LINE%"
echo [%TIMESTAMP%] === Reboot started === >> "%LOGFILE%"

:: ==== KILL EXISTING PROCESSES ====
call :colorEcho 6 "Killing old node/python processes..."
taskkill /F /IM node.exe >nul 2>&1 && echo [+] node.exe killed >> "%LOGFILE%"
taskkill /F /IM python.exe >nul 2>&1 && echo [+] python.exe killed >> "%LOGFILE%"
timeout /t 2 >nul

:: ==== START MCP SERVER ====
call :colorEcho 2 "Starting MCP Server..."
start "MCP" /min "%MCP_START_BAT%"
if %ERRORLEVEL% NEQ 0 (
    call :colorEcho 4 "[!] Failed to launch MCP server"
    echo [!] MCP server launch failed at %TIMESTAMP% >> "%LOGFILE%"
) else (
    echo [+] MCP start triggered at %TIMESTAMP% >> "%LOGFILE%"
)

:: Allow a moment for MCP to come up
timeout /t 2 >nul

:: ==== START PRESENTER ====
call :colorEcho 2 "Starting Presenter (regenerate UI)..."
if exist "%PYTHON_PATH%" (
    start "Presenter" /min "%PYTHON_PATH%" "%PRESENTER_SCRIPT%"
    if %ERRORLEVEL% NEQ 0 (
        call :colorEcho 4 "[!] Failed to launch presenter.py with %PYTHON_PATH%"
        echo [!] presenter.py failed at %TIMESTAMP% >> "%LOGFILE%"
    ) else (
        echo [+] presenter.py started OK with %PYTHON_PATH% >> "%LOGFILE%"
    )
) else (
    where python >nul 2>&1
    if !ERRORLEVEL! == 0 (
        start "Presenter" /min python "%PRESENTER_SCRIPT%"
        if !ERRORLEVEL! NEQ 0 (
            call :colorEcho 4 "[!] Failed to launch presenter.py with python on PATH"
            echo [!] presenter.py failed at %TIMESTAMP% >> "%LOGFILE%"
        ) else (
            echo [+] presenter.py started OK with python on PATH >> "%LOGFILE%"
        )
    ) else (
        where py >nul 2>&1
        if !ERRORLEVEL! == 0 (
            start "Presenter" /min py -3 "%PRESENTER_SCRIPT%"
            if !ERRORLEVEL! NEQ 0 (
                call :colorEcho 4 "[!] Failed to launch presenter.py with py -3"
                echo [!] presenter.py failed at %TIMESTAMP% >> "%LOGFILE%"
            ) else (
                echo [+] presenter.py started OK with py -3 >> "%LOGFILE%"
            )
        ) else (
            call :colorEcho 4 "[!] Python not found at %PYTHON_PATH% or on PATH"
            echo [!] Python missing at %PYTHON_PATH% and no python/py on PATH >> "%LOGFILE%"
        )
    )
)

call :colorEcho 7 "%LINE%"
call :colorEcho 2 "NAVI reboot triggered. Check UI and logs."
call :colorEcho 7 "%LINE%"
echo [%TIMESTAMP%] === Reboot complete === >> "%LOGFILE%"
pause
exit /b 0
