@echo off
echo ========================================
echo Testing NAVI Presenter
echo ========================================
echo.

cd /d "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter"

echo Current directory:
cd
echo.

echo Files in this directory:
dir /b
echo.

echo Running presenter.py...
D:\Python312\python.exe presenter.py

echo.
echo ========================================
echo Check if index.html was created
echo ========================================
if exist index.html (
    echo SUCCESS: index.html exists







pause)    echo FAILED: index.html not created) else (    start index.html    echo Opening in browser...    