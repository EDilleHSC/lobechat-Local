Operator Checklist — Trust Routing Live Run

Pre-demo
- Ensure MCP server running on port 8005 (override via the `PORT` environment variable if needed)
- Confirm CI last run green (optional but recommended)
- Confirm NAVI tree exists (NAVI/inbox, NAVI/agents/agent1/inbox, NAVI/presenter)
- Prepare the example file: `case_study_input.txt`

During demo
1. Drop file: `echo "case study" > NAVI/inbox/case_study_input.txt`
2. Trigger processing: `curl -X POST http://localhost:8005/process` (or `curl -X POST http://localhost:$PORT/process` when using the PORT override)
3. Verify snapshot: `ls -t NAVI/snapshots/inbox | head -n1` and `cat`
4. Verify router wrote meta: `ls NAVI/agents/agent1/inbox/*.meta.json` and `cat <file>.meta.json`
5. Verify presenter: open `NAVI/presenter/index.html` and check TRUST_HEADER
6. Verify receipt (future step): `ls NAVI/agents/agent1/receipts` and validate

If any step fails: stop and show the relevant log
- Server logs: `pm2 logs mcp-navi --lines 200`
- Snapshot folder: `ls NAVI/snapshots/inbox`
- Router logs: search for `[ROUTER]` lines

Post-demo
- Record outcome, snapshot id and file names
- Mark run status: PASS / FAIL
- If FAIL, file a ticket with logs and timestamp

RUN: 2025-12-17T20-27-20-387Z
Items: 2
Result: Approved
Reviewer: Eric Dille (Operator)
Notes: Snapshot, routing, and presenter verified.


RUN: 2025-12-18T10-32-19-286Z
Items: 6
Result: Approved
Reviewer: Eric Dille (Operator)
Notes: Snapshot, routing, presenter, and approved UI verified.

## Design Approval
- New page: `presenter/design-approval.html` is available to collect operator signoffs and approvals.
- Prefer persistent approvals: the system exposes a token-gated endpoint `POST /approval` that writes approvals to `NAVI/approvals/YYYY-MM-DD/*.approval.json` and appends `NAVI/approvals/audit.log` for a readable audit trail. Configure `MCP_APPROVAL_TOKEN` in your environment to enable this endpoint.
- Use for checklist-driven approvals; do not expose the token publicly — require internal network access or token auth for production.

## Operator Guide — Design Approval (quickstart)

1. Access the approval UI
   - Open `presenter/design-approval.html` (use `http://<host>:$PORT/presenter/design-approval.html` for local runs)
2. Fill the form
   - **approvedBy** (required), **role** (optional), **notes**, checklist booleans (`layout`, `accessibility`, `bugFixed`, `production`) and **status** (`approved` | `revision` | `rejected`)
3. Submit
   - Client posts to `POST /approval` with header `x-mcp-approval-token: <TOKEN>`
   - On success, a file is written:
     `NAVI/approvals/YYYY-MM-DD/<timestamp>-<sanitized-name>.approval.json`
   - Audit entry appended to `NAVI/approvals/audit.log` in the form:
     `ISO_TIMESTAMP<TAB>status<TAB>approvedBy<TAB>filepath`
4. Verify
   - Check `NAVI/approvals/` and `NAVI/approvals/audit.log` for the new entry
   - Example sample file: `docs/examples/approval.example.json`

## Ops / Retention Note

- **Audit rotation**: rotate `NAVI/approvals/audit.log` when it exceeds 5MB (file rotation already implemented in server; consider retention + archival schedule)
- **Backup strategy**: weekly archive of `NAVI/approvals/` (daily if high volume). Optionally upload archive to an S3 bucket (encrypted) for long-term storage.
- **Safe deletion policy**: retain `.approval.json` files for **90 days minimum** on disk before eligible for pruning; keep audit archives for 1 year.
- **Automation**: recommend a scheduled job (cron/Windows scheduled task or GitHub Action) to compress and move approvals older than N days to archival storage and to prune after retention window expiration. Include a dry-run mode and alerts on large prune counts.

For more details and operational runbooks, see the release notes in `docs/RELEASE_NOTES.md`.

