# Copilot / AI Agent Instructions — VBoarder (NAVI) — Extended reference

This file contains the full, detailed guidance (moved from `copilot-instructions.md`). Use it when you need run examples, troubleshooting, or longer operator flows.

This repository implements a small file-driven "MCP" (minimal control plane) that snapshots an inbox, runs a mailroom/router, and deterministically generates a presenter HTML artifact containing a TRUST_HEADER for provenance.

Purpose: enable code edits and tests without introducing regressions to the deterministic presenter's trust guarantees.

Key components (big picture)
- runtime/triage_*/mcp_server.js — HTTP server exposing endpoints used by CI/tests and by operator tooling:
  - POST /process — take snapshot, run mailroom/router, regenerate presenter
  - POST /mcp (JSON-RPC) — tools like list_directory (with path access checks)
  - GET /presenter/* — serve canonical presenter UI; inject TRUST_HEADER if none exists
  - POST /approval — token-gated approval persistence (AJV-validated against schemas/approval.schema.json)
- runtime/mailroom_runner.py — simple mailroom stub for Beta-1 (copies latest snapshot files to agents)
- runtime/router.js — computes per-file metadata (checksum, routing_id) and writes *.meta.json
- NAVI/ — important directories:
  - NAVI/inbox (incoming files)
  - NAVI/snapshots/inbox (immutable snapshot JSON files)
  - NAVI/presenter (operator-approved UI)
  - NAVI/presenter/generated (automatically generated preview files)
  - NAVI/agents/*/inbox (agent inbox directories + meta files)

Project-specific conventions & patterns (explicit, verifiable)
- Determinism & provenance: presenter HTML must contain exactly one TRUST_HEADER comment block with keys: rendered_at (UTC ISO8601 Z), snapshot_id (snapshot filename), items_processed (integer or UNKNOWN). See tests in runtime/*/tests (smoke_presenter.js, test_single_trust_header.js).
- Snapshot filenames: produced from new Date().toISOString() with colons/dots replaced by `-`. Look for logic that uses `.replace(/[:.]/g,'-')`.
- Atomic writes: use a `.tmp` file + rename pattern when persisting JSON or HTML (presenter JSON, generated index.html, approval files). Follow existing pattern to avoid partially-written files.
- Path security: `mcp_server.js` normalizes paths to lower-case and checks against an allow-list (`isPathAllowed`). When adding list_directory or similar helpers, preserve lower-casing and the same allow-list behavior.
- PID/lock behavior: server writes `mcp_server.pid` and enforces a single instance (stale PID cleanup). Use `process.lock` for single-run protection in /process handler.
- Metadata: router writes `<file>.meta.json` adjacent to routed file; presenter reads these for enrichment.

How to run (developer workflows)
- Start server (development):
  - Direct: cd runtime/triage_<...> && node mcp_server.js
  - PM2 (used in ops): pm2 start runtime/triage_<...>/ecosystem.config.js --only mcp-navi
  - Watch logs: pm2 logs mcp-navi --lines 150
- Run tests (no test runner configured; tests are standalone node scripts under runtime/*/tests):
  - Example smoke + header count tests:
    - PORT=8005 node runtime/triage_*/tests/smoke_presenter.js
    - PORT=8005 node runtime/triage_*/tests/test_single_trust_header.js
  - Approval tests require an approval token set: MCP_APPROVAL_TOKEN=secret PORT=8005 node runtime/triage_*/tests/approval_integration_smoke.js

Common End-to-End Test Sequence (Copy-Paste)

_Local Review-Mode Smoke (most common)_

1) Start the MCP server (Review Mode)

export PORT=8005
export MCP_APPROVAL_TOKEN=TEST_APPROVAL
node runtime/triage_20251216_172245/mcp_server.js

2) Drop a test file into inbox

echo "test content" > NAVI/inbox/example.txt

3) Trigger processing (snapshot + presenter only)

curl -X POST http://localhost:8005/process

4) Open Review UI (read-only, advisory)

http://localhost:8005/presenter/index.html

5) Submit an approval (persistent + audited)

curl -X POST http://localhost:8005/approval \
  -H "Content-Type: application/json" \
  -H "X-MCP-APPROVAL-TOKEN: TEST_APPROVAL" \
  -d '{
    "approvedBy": "Operator",
    "date": "2025-12-18T00:00:00Z",
    "role": "QA",
    "notes": "Review-mode approval",
    "checklist": { "layout": true, "accessibility": true, "bugFixed": true, "production": true },
    "status": "approved"
  }'

If an approval POST returns HTTP 503 or 403, restart the server ensuring `MCP_APPROVAL_TOKEN` is set in the server's environment — restarting the helper script alone will not suffice.

6) Verify artifacts

ls NAVI/snapshots/inbox
ls NAVI/approvals/YYYY-MM-DD/
tail -n 5 NAVI/approvals/audit.log

CI / Test Validation (what CI runs)

# Design Approval UI smoke
node runtime/triage_20251216_172245/tests/design_approval_smoke.js

# Approval endpoint integration
node runtime/triage_20251216_172245/tests/approval_integration_smoke.js

# Negative tests
node runtime/triage_20251216_172245/tests/approval_missing_token.js
node runtime/triage_20251216_172245/tests/approval_invalid_json.js
node runtime/triage_20251216_172245/tests/approval_invalid_status.js

Useful env vars:
- PORT — override HTTP port (default 8005)
- BETA0_TRUST_MODE — '1' keeps Beta‑0 behavior (skip mailroom routing and just regenerate presenter)
- MAILROOM_STRICT — '1' makes /process fail on mailroom errors
- MCP_APPROVAL_TOKEN — required value for POST /approval requests
- ENABLE_TEST_ADMIN and MCP_SHUTDOWN_TOKEN — enable/test admin shutdown endpoint (/__mcp_shutdown)

Testing notes & expectations (be conservative)
- Tests rely on the single-TRUST_HEADER invariant and consider the canonical presenter preferred; fallback to generated preview is allowed in tests.
- The presenter-serving endpoint injects a TRUST_HEADER only if none is present in the file; this is intentional (operator UI is authoritative). When making presenter changes, ensure you don't create duplicate headers.
- When adding new file output, prefer the `.tmp` + `fs.renameSync` pattern used throughout the codebase.

Integration points & external dependencies
- Python (explicit runtime): mcp_server uses hard-coded Python path `D:\Python312\python.exe` to run `mailroom_runner.py`. If changing the mailroom or tests, verify the Python path and behavior on CI runners.
- pm2 is used for process management in production/ops flows (see `ecosystem.config.js`).
- JSON schema validation using AJV for approvals: see `schemas/approval.schema.json`.

Editing guidelines for AI agents (concrete, short)
- Preserve existing directory and write patterns (snapshot naming, tmp-then-rename, metadata filenames).
- When touching snapshot/listing code, maintain the `isPathAllowed` logic and the lower-casing normalization — do not expand access silently.
- For presenter changes: keep TRUST_HEADER format and single-instance guarantee; update tests in `runtime/*/tests` when you change header behavior.
- Use the approval schema (`schemas/approval.schema.json`) as the source-of-truth for approval endpoint changes.
- If adding a new endpoint that touches disk or routing, add a smoke test in `runtime/*/tests` and document behavior in `README_BETA0.md`.

Where to look first (good entry points)
- `runtime/*/mcp_server.js` — core behavior and request handling
- `runtime/*/tests/*` — the test expectations and examples of how to interact with the server
- `runtime/router.js` and `runtime/mailroom_runner.py` — routing and metadata patterns
- `README_BETA0.md` — project purpose, trust loop, and CI expectations

Troubleshooting checklist ✅
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

Operator Test Flow (Desk v1) 🧭
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