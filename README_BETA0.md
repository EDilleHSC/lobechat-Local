# Beta‑0 Trust Loop — README

---

## NAVI PRODUCT EXECUTION RULES (BETA)

**1. One Screen Rule**
- There is one primary screen per phase. The Beta primary screen is **NAVI Mail Room Update**. Anything else is supporting infrastructure. If work does not improve the primary screen, stop.

**2. No Shadow UIs**
- Supporting UIs must embed into the primary UI or be invisible to the user. Standalone pages are temporary only.

**3. Visible State Change Requirement**
- Every user action must change something on screen within the same flow immediately. Logs without UI reflection = incomplete.

**4. Tests Follow Product, Not Infrastructure**
- Tests verify what the user sees, not internal-only effects. If tests pass but the UI still looks wrong, the test is lying.

**5. "Stop & Re-anchor" Check**
- At the start of every day, answer in one sentence: “What will look different in Mail Room tonight?” If the answer is unclear — do not code yet.

---

## Purpose
This document records the Beta‑0 trust contract: a minimal, deterministic verification loop that proves the system authoritatively generates the NAVI presenter artifact (`index.html`) and that the artifact contains a deterministic TRUST_HEADER for provenance.

## Scope
- Snapshot of inbox is taken by the MCP server and written to `NAVI/snapshots/inbox/` as immutable JSON files.
- The Presenter generator deterministically writes the canonical file at `D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\index.html`.
- The generated HTML contains a `<!-- TRUST_HEADER ... -->` block with deterministic fields.
- CI enforces a minimal smoke test and a trust-header-count test to prevent regressions.

## Completion conditions (Beta‑0)
- Presenter regenerates deterministically on every `/process` invocation.
- Canonical `index.html` contains a single `TRUST_HEADER` block.
- `TRUST_HEADER` contains valid `rendered_at` (UTC ISO8601), `snapshot_id` (snapshot filename), and `items_processed` (integer or `UNKNOWN`).
- CI (`.github/workflows/beta0-smoke.yml`) runs the smoke test and the header-count test on each push.

## Snapshot → Presenter flow
1. POST `http://localhost:8005/process` triggers the pipeline (for test runs you can override the port with the PORT env var and use `http://localhost:$PORT/process`).
2. MCP writes a snapshot JSON to `NAVI/snapshots/inbox/` (immutable JSON with timestamped filename).
3. The Presenter regeneration routine writes `index.html` atomically (tmp file → rename) to the canonical path above.
4. The file includes a `TRUST_HEADER` block indicating provenance and freshness.

## TRUST_HEADER specification
A TRUST_HEADER is a single HTML comment block with three deterministic fields:
```
<!-- TRUST_HEADER
rendered_at: 2025-12-17T20:28:30.405Z
snapshot_id: 2025-12-17T20-28-30-404Z.json
items_processed: 2
-->
```
- `rendered_at` — UTC timestamp when the presenter file was written (ISO 8601, Z suffix).
- `snapshot_id` — the filename of the snapshot used to render (from `NAVI/snapshots/inbox/`).
- `items_processed` — number of items the snapshot contained (or `UNKNOWN` if unavailable).

## Local verification
- Manually: open `D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\index.html` in a browser and verify `TRUST_HEADER` in page source.
- Automated: run `node runtime/triage_*/tests/smoke_presenter.js` and `node runtime/triage_*/tests/test_single_trust_header.js`.

---

## Operator Test Flow — Desk v1 🧭
**Review Mode only — no automation**

Follow these steps when performing a manual operator review (Desk v1). These are intentionally manual and require operator acknowledgement at each step.

1) Start the server (Review Mode)

```bash
export PORT=8005
export MCP_APPROVAL_TOKEN=TEST_APPROVAL
node runtime/triage_20251216_172245/mcp_server.js
```

2) (Optional) Drop a sample file into the inbox

```bash
# Local (bash)
echo "test content" > NAVI/inbox/example.txt

# Windows PowerShell
Set-Content -Path NAVI\inbox\example.txt -Value "test content"
```

3) Trigger processing (snapshot + presenter)

```bash
curl -X POST http://localhost:8005/process
```

4) Review results
- Open the Review UI (read-only): `http://localhost:8005/presenter/index.html`
- Optionally inspect generated preview: `NAVI/presenter/generated/index.html`

5) Submit approval (manual step — recorded and audited)

Use the approval endpoint only after human review. Example curl (replace token if needed):

```bash
curl -X POST http://localhost:8005/approval \
  -H "Content-Type: application/json" \
  -H "X-MCP-APPROVAL-TOKEN: TEST_APPROVAL" \
  -d '{"approvedBy":"Operator","status":"approved","checklist":{"layout":true,"accessibility":true,"bugFixed":false,"production":false}}'
```

Expected response: HTTP 201 with JSON containing a `file` field that is the full path to the persisted `.approval.json` file. The approvals audit log is appended at: `D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\approvals\audit.log`.

**Important:** The approval endpoint only works if the server was started with `MCP_APPROVAL_TOKEN` set in the same environment/process (for example, `export MCP_APPROVAL_TOKEN=TEST_APPROVAL` before running `node runtime/triage_20251216_172245/mcp_server.js`). If an approval POST returns HTTP 503 or 403, restart the server ensuring `MCP_APPROVAL_TOKEN` is set in the server's environment — restarting the helper script alone will not suffice. See the schema at `runtime/triage_20251216_172245/schemas/approval.schema.json` for required payload fields.

Scripts available to help run the flow:
- `scripts/run_operator_flow.ps1` — PowerShell helper for Windows operators (fails fast if no `MCP_APPROVAL_TOKEN` is present)
- `scripts/run_operator_flow.sh` — Bash helper (WSL/CI-friendly) (fails fast if no `MCP_APPROVAL_TOKEN` is present)

> Note: these scripts are for **Review Mode** only — they start the server if needed, optionally drop a sample file, trigger `/process`, and print the Review UI + Design Approval next steps. They will never auto-approve or automate human decisions.

---

## CI smoke check badge & usage
[![PR Local Smoke](https://github.com/EdilleHSC/lobechat-Local/actions/workflows/local-smoke.yml/badge.svg)](https://github.com/EdilleHSC/lobechat-Local/actions/workflows/local-smoke.yml)

The repository includes `.github/workflows/local-smoke.yml` which runs `scripts/run_local_smoke.sh` on PRs (Ubuntu). The job uploads snapshots, generated presenter previews, and the approvals audit log when a run fails to make debugging easier.

## CI
- Workflow: `.github/workflows/beta0-smoke.yml`
  - Starts MCP server on a Windows runner, waits for `/health`, runs smoke test and trust header count test, then cleans up.
- Passing CI on `main` is required to accept changes that could affect the trust loop.

## Release
This repository will be tagged `v0.1.0-beta0` to mark the Beta‑0 trust baseline. The tag documents the presence of deterministic presenter generation, the TRUST_HEADER standard, and CI enforcement.

---
For questions or to propose Beta‑1 features (mailroom restoration, routing, richer tests), open an issue or PR referencing this document.

## Playwright E2E Tests ✅

To run the E2E tests locally:

```bash
# Run all Playwright e2e tests
npx playwright test tests/e2e
```

To update visual snapshots locally (rebaseline):

```bash
# Re-generate failing visual baselines
npx playwright test --update-snapshots
```

What GitHub Actions does for these tests:

- Runs `npx playwright test` using the `playwright.yml` workflow on push/PR to `main`.
- The workflow starts a lightweight static server using `npx http-server . -p 8005 -c-1` (configured via `playwright.config.js:webServer`).
- Failed snapshot diffs and test artifacts are uploaded as `playwright-report/` and `test-results/` artifacts to the workflow run.

If you see visual differences in CI, download the artifacts from the failing run, validate the diffs locally, and update snapshots locally using `npx playwright test --update-snapshots` if the change is expected.

## Mail Room & audit log

The Mail Room UI (`presenter/index.html`) reads `NAVI/approvals/audit.log` via the server endpoint `GET /approvals/audit` and renders the latest decision per file.

Use the Track/Hold/Escalate buttons to open a small notes prompt and submit the same payload as the Design Approval page (`POST /approval`). The server appends a line to `NAVI/approvals/audit.log` and the Mail Room will pick it up on its next refresh.

To run the Mail Room UI locally:

```bash
# Start the dev server with a test token
$env:MCP_APPROVAL_TOKEN='TEST_APPROVAL'
node scripts/dev_server.js
# Open http://localhost:8005/presenter/index.html
```

To test via Playwright locally:

```bash
npx playwright test tests/e2e/mailroom.spec.js
```

<!-- CI trigger: whitespace -->

