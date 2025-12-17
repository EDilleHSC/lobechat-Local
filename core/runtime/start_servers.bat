@echo off
rem Start all runtime servers - core/runtime
call "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\core\runtime\start_mcp_server.bat" %*
call "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\core\runtime\start_presenter.bat" %*
