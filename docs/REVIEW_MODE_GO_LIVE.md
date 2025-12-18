# Review Mode Go‑Live Checklist

This document declares the system is entering **Review Mode (Go‑Live)** for operational use under controlled review. It documents acceptance criteria, go‑live steps, monitoring plan, rollback steps and stakeholder signoff items.

## Status
- Date: 2025-12-18
- Branch (prepared): `release/review-mode-go-live`

## Acceptance Criteria (must be satisfied before declaring Go‑Live)
- CI: smoke workflows (`beta0-smoke.yml`, `runtime-restore-check.yml`) pass **3 consecutive** runs on `main` with no flakes.
- Smoke tests: `smoke_presenter.js`, `mailroom_smoke.js`, `routing_poc_smoke.js`, `pidfile_smoke.js`, `agent_receive_smoke.js` pass reliably against the job-level port (PORT: 18005).
- PID-file guard: `pidfile_smoke.js` success rate above threshold (100% for initial rollout).
- Monitoring: `/health` endpoint checks present, and alerts configured for repeated restarts, EADDRINUSE, or PID-file errors.
- Runbook updated: `docs/CASE_STUDY_RUNBOOK.md`, `docs/OPERATOR_CHECKLIST.md` include the PORT override note and emergency rollback steps (done).
- Stakeholder sign-off: Ops, Security, Product reviewers acknowledged the checklist.

## Go‑Live plan
1. **Pre-window checks (T-30m)**
   - Ensure CI is green; ensure no scheduled maintenance or high-impact deploys.
   - Notify stakeholders via the agreed channel (e.g., Slack: #ops-alerts) with a short playbook.

2. **Go‑Live window (T0)**
   - Trigger a controlled smoke-run (Sequence below).
   - Monitor logs & health (first 15 minutes): PM2 logs, `server.pid`, `/health` checks.

3. **Smoke-run sequence**
   - Start MCP server (CI uses `PORT=18005`).
   - Wait for `/health` to return 200.
   - Run `smoke_presenter.js` → expect TRUST_HEADER.
   - Run `pidfile_smoke.js` → expect PID file created and removed on shutdown.
   - Run `mailroom_smoke.js`, `routing_poc_smoke.js`, `agent_receive_smoke.js`.
   - Verify presenter and agent inbox updates and checksums.

4. **Post-window checks (T+30m)**
   - Confirm all smoke tests passed and no alerts fired.
   - If issues: follow rollback plan and file incident ticket.

## Monitoring & Alerts
- **Metrics to track:** server restarts (PM2), `/health` failures, EADDRINUSE occurrences, pidfile existence mismatches, CPU/memory anomalies.
- **SLOs:** uptime >= 99% over 7 days, health check success in 15s during smoke-run.
- **Alerting:** Pager for repeated restarts (>3 in 10m), health endpoint failure (>=3 failed checks in 5m), PID-file guard failure.
- **Dashboards:** short-term smoke-run dashboard showing active checks, last successful run timestamps, and recent logs.

## Rollback plan
- **Soft rollback (fast):** Stop automated restarts (PM2) and switch MCP process to manual mode, preserving logs and pidfile for debugging.
- **Hard rollback:** Restore last known good commit or revert the PR that triggered the regression (maintain a timeline and evidence).
- Document incident, collect logs, reproduce failure, and schedule a fix/retro.

## Communication / Announcement template
- Title: "Review Mode Go‑Live — MCP service" (date/time)
- Body: Short bullets: what changed, smoke-run schedule, expected impact (none), how to contact ops on failure.

## Sign-offs
- Ops lead: __________________
- Security lead: __________________
- Product owner: __________________

---

### Design Approval UI
- Added `presenter/design-approval.html` as an operator-facing page to capture design approvals and QA signoffs.
- Smoke test `runtime/triage_20251216_172245/tests/design_approval_smoke.js` verifies presence of required fields and basic client-side validation.
- CI: `.github/workflows/design-approval-smoke.yml` will run the smoke check on PR and branch pushes to ensure the page is shipped with basic tests.
- Recommended: wire `approveDesign()` to a secure internal endpoint or persist a `.approval.json` artifact when approvals should be auditable.

_Future work (post-review): enforce receipts as a hard gate; tighten routing confidence thresholds and metrics; define Autonomy Mode graduation criteria._
