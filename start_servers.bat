@echo off
cd /d D:\05_AGENTS-AI\01_RUNTIME\VBoarder

echo Starting VBoarder MCP Server...
start "" node mcp_server.js

echo Waiting for MCP server to initialize...
timeout /t 3 >nul

echo Starting VBoarder Status Server...
start "" python3.12.exe status_server.py

echo VBoarder servers started successfully.
echo.
echo Press any key to close this window...
pause >nul