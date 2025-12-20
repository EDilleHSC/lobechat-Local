Operator Checklist — Trust Routing Live Run

Pre-demo
- Ensure MCP server running on port 8005 (override via the `PORT` environment variable if needed)
- Confirm CI last run green (optional but recommended)
- Confirm NAVI tree exists (NAVI/inbox, NAVI/agents/agent1/inbox, NAVI/presenter)
- Prepare the example file: `case_study_input.txt`
- Health check: `curl -i http://localhost:8005/presenter/index.html` (200 OK means server is alive)

During demo
1. Drop file: `echo "case study" > NAVI/inbox/case_study_input.txt`
2. Trigger processing: `curl -X POST http://localhost:8005/process` (or `curl -X POST http://localhost:$PORT/process` when using the PORT override)
3. Verify snapshot: `ls -t NAVI/snapshots/inbox | head -n1` and `cat`
4. Verify router wrote meta: `ls NAVI/agents/agent1/inbox/*.meta.json` and `cat <file>.meta.json`
5. Verify presenter: open `NAVI/presenter/index.html` and check TRUST_HEADER
6. Make GTD decisions: Open `http://localhost:8005/presenter/index.html` → Click "Open Review (GTD Decisions)" → Make decisions for each file → Submit Approval
7. Apply decisions: Run `.\apply_approval.ps1 -ApprovalPath <approval_file_path>` (path shown in UI success message)
8. Verify no reprocessing: `curl -X POST http://localhost:8005/process` → Check presenter shows 0 items (files moved out of inbox)
9. Verify receipt (future step): `ls NAVI/agents/agent1/receipts` and validate

✅ What you can verify today
- presenter.json shows the same snapshot_id you just created
- each item lists filename, checksum_sha256, meta_path, and "Suggested Handler"
- design-approval UI loads items and requires GTD
- Submit creates an *.approval.json receipt tied to snapshot
- audit log appends an entry for the submission

❌ What you cannot verify yet (unless implemented)
- files moved to processed/, escalated/, rejected/
- "no reprocessing" (because files still sitting in NAVI/inbox will keep getting snapped every run)

The missing feature: "Apply Decisions"

To make the promise "files move + no reprocessing" true, add a separate step after approval:

Option A (safest, simplest): Operator-run mover script
- Keep server + UI as-is
- Add apply_approval.ps1 that:
  - reads the saved approval receipt
  - moves files from NAVI\inbox\ → NAVI\processed\<snapshot_id>\<gtd_outcome>\
  - escalations go to NAVI\escalated\<snapshot_id>\
  - writes a move log (what moved, what was missing)
- This keeps the trust chain clean: review produces a receipt; apply enforces it.

Option B (still good): server endpoint
- Add POST /apply-approval (token gated), takes either:
  - approval_receipt_path, or
  - snapshot_id + reviewer + timestamp
- Server moves files and writes an apply receipt.

Key guardrails either way:
- do not delete—move only
- if file missing, log + continue
- (optional but strong) verify checksum before moving

Updated "Real Intake Test" (the correct version)
- Drop 5–10 mixed files into NAVI\inbox
- POST /process
- Open /presenter/index.html → click Open Review (GTD Decisions)
- Make GTD decisions → Submit → confirm receipt + audit updated
- Run Apply Decisions (script or endpoint)
- Run /process again → confirm moved files are not reprocessed

One more thing: why your UI looked "blank" in that screenshot
- You were using port 8006 in VS Code Simple Browser (http://localhost:8006/...) while the server is on 8005. That exact mismatch produces a "blank white page" pattern depending on what's served.
- So the official operator rule should be: Chrome/Edge at http://localhost:8005/presenter/index.html
- Always enter through the "Open Review" button

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

## Apply Decisions
- After submitting approval, run `.\apply_approval.ps1 -ApprovalPath <path>` to move files from inbox to outcome folders (`processed/`, `escalated/`, `rejected/` under snapshot ID).
- This prevents reprocessing: inbox is emptied, future `/process` calls only handle new files.
- Script writes an apply log alongside the approval file for audit.

## CI Secrets (Approval tests) 🔐
To run automated approval tests (integration and negative tests) in CI, define this Actions secret in the repository settings:

- **Name**: `TEST_APPROVAL_TOKEN`
- **Value**: a test-safe token (e.g., `TEST_APPROVAL`). This value is used by CI to set `MCP_APPROVAL_TOKEN` during test runs.

These tests validate that missing tokens, malformed payloads, and invalid enums are rejected safely by `POST /approval`.

---

## Desk v1 — Final, Clean Operator Experience ✅

**Mental model (the key)**

- **Folders = state** (what exists)
- **Buttons = intent** (what you choose to do)
- Nothing auto-acts — operators always press one button to move forward
- No hidden processing. No guessing. No leaking implementation details.

**Desktop layout (left → right, top row)**

[ NAVI Inbox ]   [ ▶ Process Inbox ]   [ 👁 Open Review (Clara) ]   [ ✅ Design Approval ]

### 1️⃣ NAVI Inbox (folder shortcut)
**Icon name:** `NAVI Inbox`
**Target:** `D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\inbox`
**Purpose:** Operator drops files here. Nothing happens until a button is pressed.

### 2️⃣ ▶ Process Inbox (the ONLY processing trigger)
**Icon name:** `▶ Process Inbox`
**Type:** Windows shortcut → `.bat`
**Target:** `D:\05_AGENTS-AI\01_RUNTIME\VBoarder\Scripts\process_inbox.bat`

**process_inbox.bat (copy-paste exactly)**
```
@echo off
set PORT=8005

echo =====================================
echo NAVI — Process Inbox
echo =====================================
echo.

curl -s -X POST http://localhost:%PORT%/process
IF ERRORLEVEL 1 (
  echo.
  echo ❌ Processing failed. Check server logs.
  pause
  exit /b 1
)

echo.
echo ✅ Inbox processed successfully.
echo You may now open Review.
pause
```

**Why this matters:** One intentional action, human-readable result, no background magic.

### 3️⃣ 👁 Open Review (Clara)
**Important:** Do NOT open Clara by double-clicking an `.html` file — Clara is served by the MCP server.

**Icon name:** `👁 Open Review (Clara)`
**Type:** Internet Shortcut (`.url`)
**Target:** `http://localhost:8005/presenter/index.html`
**Purpose:** Read-only review (TRUST_HEADER, routing output, presenter)

### 4️⃣ ✅ Design Approval
**Icon name:** `✅ Design Approval`
**Type:** Internet Shortcut (`.url`)
**Target:** `http://localhost:8005/presenter/design-approval.html`
**Purpose:** Explicit human sign-off. Writes `.approval.json` and appends `audit.log` (token-gated).

### FINAL OPERATOR CHECKLIST (Desk-matched, copy-paste)
**Pre-run**
- MCP server running
- Desktop shows 4 icons only
- Inbox is visible and empty (or reviewed)

**Run (always in this order)**
1. Drop files
   - Drag files into `NAVI Inbox`

2. Process
   - Double-click `▶ Process Inbox`
   - Wait for: `✅ Inbox processed successfully.`

3. Review
   - Click `👁 Open Review (Clara)`
   - Verify: Snapshot exists, routing looks correct, TRUST_HEADER visible

4. Approve (if ready)
   - Click `✅ Design Approval`
   - Fill checklist + status, Submit

5. Verify (optional but recommended)
   - Check `NAVI/approvals/YYYY-MM-DD/*.approval.json`
   - Check `NAVI/approvals/audit.log`

**If anything feels wrong**
- STOP — do not re-process, do not approve. Check logs or rerun review only.

**Why this fixes confusion:** Folder = place, Button = action, Browser = view, Approval = decision. Each step is visible and intentional.

**Next:** After 5–10 real runs we can spec Desk v2 (status badges only, NEVER auto-process). For now: Desk v1 is correct.

