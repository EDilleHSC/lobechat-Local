@echo off
echo ========================================
echo NAVI PRESENTER - COMPLETE FIX
echo ========================================
echo.

set PRESENTER_DIR=D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter

echo Step 1: Backing up current template...
if exist "%PRESENTER_DIR%\template.html" (
    copy "%PRESENTER_DIR%\template.html" "%PRESENTER_DIR%\template.html.backup" >nul
    echo ✓ Backup created
) else (
    echo ! No existing template found
)
echo.

echo Step 2: Checking for updated template_final.html...
if exist "%USERPROFILE%\Downloads\template_final.html" (
    echo ✓ Found template_final.html in Downloads
    copy "%USERPROFILE%\Downloads\template_final.html" "%PRESENTER_DIR%\template.html" >nul
    echo ✓ Copied as template.html
) else (
    echo ! template_final.html not found in Downloads
    echo ! Please download it first and place in Downloads
    pause
    exit /b 1
)
echo.

echo Step 3: Deleting old index.html...
if exist "%PRESENTER_DIR%\index.html" (
    del "%PRESENTER_DIR%\index.html"
    echo ✓ Deleted old index.html
) else (
    echo ! No old index.html found
)
echo.

echo Step 4: Running presenter.py...
cd /d "%PRESENTER_DIR%"
D:\Python312\python.exe presenter.py
echo.

echo Step 5: Verifying index.html was created...
if exist "%PRESENTER_DIR%\index.html" (
    echo ✓ SUCCESS: index.html created
    echo.
    echo Step 6: Opening test file and actual presenter...
    timeout /t 2 >nul
    
    REM Open layout test if present in Downloads




























pauseecho.)    echo Check the output above for errors    echo ✗ FAILED: index.html was not created) else (    echo ========================================    echo press Ctrl+F5 to hard refresh!    echo If index.html still shows HORIZONTAL buttons,     echo.    echo 2. index.html = Should match the vertical layout    echo 1. layout_test.html = CORRECT vertical layout with colored borders    echo ========================================    echo COMPARE THE TWO BROWSER WINDOWS:    echo ========================================    echo.    echo ✓ Opened index.html    start "" "%PRESENTER_DIR%\index.html"    REM Open actual presenter        )        echo ! layout_test.html not found in Downloads    ) else (        timeout /t 1 >nul        echo ✓ Opened layout_test.html        start "" "%USERPROFILE%\Downloads\layout_test.html"    if exist "%USERPROFILE%\Downloads\layout_test.html" (    