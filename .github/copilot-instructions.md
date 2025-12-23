# Copilot / AI Agent Instructions — VBoarder (NAVI)

Short summary
- VBoarder is a deterministic mailroom + presenter: files -> snapshot -> router -> canonical presenter HTML with a single TRUST_HEADER.

Must preserve (critical)
- TRUST_HEADER: exactly one comment block with keys `rendered_at` (ISO Z), `snapshot_id`, `items_processed`.
- Atomic writes: `.tmp` -> `fs.renameSync` (avoid partial files).
- Snapshot naming: ISO timestamp filenames with `:`/`.` -> `-`.
- Path checks: lower-case normalization + `isPathAllowed` allow-list.
- Approval auth: `MCP_APPROVAL_TOKEN` required for POST `/approval`.
- Tests: add/adjust node smoke tests in `runtime/*/tests` when changing runtime behavior.

Quick dev commands
- Start server: cd runtime/triage_*/ && PORT=8005 node mcp_server.js
- Local smoke: ./scripts/run_local_smoke.sh or .\scripts\run_local_smoke.ps1
- Run key tests: node runtime/triage_*/tests/smoke_presenter.js

Compact architecture (ASCII)
INBOX -> mailroom_runner.py -> snapshot -> router.js (writes <file>.meta.json) -> presenter (injects TRUST_HEADER) -> NAVI/presenter/

Minimal endpoint examples
- POST /process: curl -X POST http://localhost:8005/process
- POST /approval: curl -X POST http://localhost:8005/approval -H "X-MCP-APPROVAL-TOKEN: TOKEN" -H "Content-Type: application/json" -d '{"approvedBy":"A","date":"2025-12-18T00:00:00Z","status":"approved"}'
- GET presenter: open http://localhost:8005/presenter/index.html

Short CI / reviewer checklist
- Run: smoke_presenter.js, test_single_trust_header.js (must pass)
- Run: approval_integration_smoke.js with MCP_APPROVAL_TOKEN
- Confirm: no duplicate TRUST_HEADER in output
- Confirm: `.tmp` -> rename pattern used for new outputs

For full guidance, see `.github/copilot-instructions-extended.md`

Full details moved to `.github/copilot-instructions-extended.md`.


## Troubleshooting checklist ✅
If a local smoke or CI validation fails, check these common causes and quick fixes:

- **EADDRINUSE / Port in use**: another instance is listening on `PORT` (default 8005). Run `netstat -a -n -o | findstr :8005` or stop the other instance (PM2 or node). You can also change `PORT` for local runs.
- **Stale PID file**: check `runtime/triage_*/mcp_server.pid`. If the PID is not running, remove the file and restart the server.
- **Lock file stuck**: if `/process` returns conflict and no job is running, remove `process.lock` from the runtime directory and retry.
- **Missing env vars**: `MCP_APPROVAL_TOKEN` must be set for approval tests; `PORT` must be consistent between steps.
- **Permission errors writing snapshots/approvals**: ensure the running user can write to `NAVI/snapshots/inbox`, `NAVI/approvals`, and `NAVI/presenter` (check ACLs on Windows).
- **Mailroom/router failures**: inspect `mailroom_runner.py` and `router.js` output; set `MAILROOM_STRICT=0` to continue while debugging or re-run `node router.js` manually to reproduce errors.
- **Duplicate TRUST_HEADER found**: the server injects a TRUST_HEADER only when the canonical HTML file lacks one; if duplicates appear check generated preview files and injection logic (`presenter` serving path).
- **Tests flaky / timing-sensitive**: increase client-side retries or sleeps when running tests locally; check timestamps in TRUST_HEADER (`rendered_at`) for freshness.

Quick recoveries:
- Kill any stray `node` processes and remove stale `mcp_server.pid` and `process.lock` before re-starting the server.
- For `EADDRINUSE`, either stop the occupying process or run the tests on an alternate `PORT`.

> Tip: Use `scripts/run_local_smoke.ps1` (PowerShell) or `scripts/run_local_smoke.sh` (Bash/WSL) to automate the common local validation sequence.

---

## Operator Test Flow (Desk v1) 🧭
This repository includes operator-facing helper scripts that implement the safe Review Mode workflow end-to-end. Use these scripts when testing real files or demonstrating the system to operators.

Scripts:
- **Windows / PowerShell:** `scripts/run_operator_flow.ps1`
- **Bash / WSL / CI:** `scripts/run_operator_flow.sh`

What the scripts do (explicit & safe):
- Verify the MCP server is running (or start it in Review Mode)
- Optionally drop a sample file into `NAVI/inbox`
- Trigger `POST /process` (snapshot + presenter only)
- Print the Review UI and Design Approval URLs
- Exit non-zero on failure; no silent actions

What they do NOT do:
- No automatic file moves
- No autonomy
- No background watchers

Usage examples:

Windows (PowerShell)
```powershell
# Windows
.\scripts\run_operator_flow.ps1
.\scripts\run_operator_flow.ps1 -NoDrop -Port 8006 -Token TEST_APPROVAL
```

WSL / Linux
```bash
# WSL / Linux
chmod +x scripts/run_operator_flow.sh
./scripts/run_operator_flow.sh
./scripts/run_operator_flow.sh --no-drop --port 8006 --token TEST_APPROVAL
```

These scripts represent the canonical Desk v1 operator flow and should be preferred over ad-hoc commands during testing and demos.

Why this matters (quick):
- 🧠 Teaches Copilot the real workflow, not just APIs
- 🧭 Aligns docs, scripts, CI, and operator behavior
- 🛡 Reinforces Review Mode safety guarantees
- 🚀 Makes user beta repeatable and boring (in a good way)

Once this is committed and pushed, the project is officially in operator beta readiness.

If you want next, I can:
- Review the scripts for UX polish (operator wording),
- Help you draft the user beta announcement, or
- Define beta success criteria (what “working” means).

Just say the word.
