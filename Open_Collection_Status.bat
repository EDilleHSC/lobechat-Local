@echo off
echo Updating COLLECTION overview...
python3.12.exe "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\collection_status.py"
start "" "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\COLLECTION\collection_status.html"
exit