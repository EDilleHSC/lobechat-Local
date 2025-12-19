# Deployment scripts

This folder contains helper scripts for running MCP server in production-like environments. None of these scripts store secrets in files — provide tokens as environment variables.

Files:
- `start_prod.ps1` — PowerShell start script (Windows)
- `stop_prod.ps1` — PowerShell stop script (Windows)
- `start_prod.sh` — POSIX start script (Linux/macOS)
- `stop_prod.sh` — POSIX stop script (Linux/macOS)
- `health_check.sh` — Polls `/health` and tails logs
- `backup_approvals.ps1` — Archive `NAVI/approvals` into `backups/`

Usage notes:
- Set `MCP_APPROVAL_TOKEN` and `MCP_SHUTDOWN_TOKEN` in environment or secret manager.
- Configure `PORT` and `LOG_DIR` as needed.
- Verify `mcp_server.js` file path discovered by the start scripts; adjust if necessary.

Security:
- Do not store tokens in version control. Use secret stores or environment variable mechanisms offered by your platform.

Example (PowerShell):
```
$env:MCP_APPROVAL_TOKEN = "<token>"
$env:MCP_SHUTDOWN_TOKEN = "<token>"
.\scripts\start_prod.ps1
```

Example (Linux):
```
export MCP_APPROVAL_TOKEN="<token>"
export MCP_SHUTDOWN_TOKEN="<token>"
./scripts/start_prod.sh
```