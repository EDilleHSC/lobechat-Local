# PM2 Restart Policy & Incident Note ✅

What broke
- PM2 was restarting `mcp-navi` in a way that created brief overlapping processes. This produced repeated "[MCP] Starting VBoarder MCP Filesystem Server..." logs and intermittent EADDRINUSE errors on port 8005.

Why it broke
- The orchestrator (PM2) allowed a new process to start before the old one finished releasing the port, causing port contention during restarts.

How it was fixed
- Added diagnostic invocation stack traces to `startServer()` for visibility.
- Introduced an `ecosystem.config.js` and started `mcp-navi` with safe restart settings (autorestart: true, restart_delay: 2000 ms, kill_timeout: 3000 ms, max_restarts: 5).
- Verified a single clean startup sequence and no EADDRINUSE on restart.

If this happens again
1. Check PM2 logs: `pm2 logs mcp-navi` and inspect for multiple startup sequences.
2. Confirm which PID owns port 8005: `netstat -ano | findstr :8005` / `tasklist /FI "PID eq <PID>"`.
3. Stop/delete the PM2 app and restart using the ecosystem file: `pm2 stop mcp-navi && pm2 delete mcp-navi && pm2 start ecosystem.config.js --only mcp-navi && pm2 save`.
4. As a temporary diagnostic measure, start with `--no-autorestart` to confirm a single startup.

Optional follow-up
- Add a PID-file / lock guard for additional defense-in-depth if this service may run outside PM2 or as a belt-and-suspenders safety net.
- Add a one-line ops entry to the team runbook documenting the change and reasoning.

Contact
- Ops owner: VBoarder team (add any on-call or Slack channel here).

Signed-off: Automated remediation + verification by the current run (see commit / change history for code edits).