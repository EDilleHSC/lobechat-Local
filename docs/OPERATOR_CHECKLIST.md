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

