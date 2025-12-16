@echo off
echo 📦 Processing COLLECTION Bulk Intake...

cd "D:\05_AGENTS-AI\01_RUNTIME\VBoarder"

python3.12.exe scan_collection.py

if %errorlevel% equ 0 (
    echo.
    echo ✅ COLLECTION scan complete!
    echo 📂 Check NAVI\COLLECTION\BATCHES for new batch
    echo 📋 Check NAVI\COLLECTION\logs\batch_log.json for details
) else (
    echo.
    echo ❌ COLLECTION scan failed or no files to process
)

echo.
pause