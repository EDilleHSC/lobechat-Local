@echo off
rem Root shim — forwards to core runtime start_servers (no logic in root)
call "core\runtime\start_servers.bat" %*

rem Note: This is a thin shim; server logic has moved to `core/runtime/` and `core/intake/pipelines/`.