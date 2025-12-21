NAVI Operating Rules (v1)

Purpose
-------
This document summarizes the operator-facing rules for NAVI. It is short, human-readable, and defines clear responsibilities between the machine (generator) and humans (operators).

High-level contract
-------------------
- The generator (AI pipeline) produces immutable analysis artifacts in `NAVI/snapshots/` and `NAVI/presenter/generated/presenter.json`.
- The operator UI is `NAVI/presenter/index.html` and is operator-owned (human-edited, reviewed via PR).
- The UI reads generated JSON; it MUST NOT mutate or write to `presenter.json` or snapshots.

Folder semantics (one-way flow)
-------------------------------
- HOLDING/: Humans drop files only. This is a capture area, not for processing.
- inbox/: AI-owned, active review queue. The generator moves files here when ready to be analyzed.
- processed/: Final routing destinations (Account, Finance, Legal, etc.).
- rejected/Trash/: Files pending deletion; retention applies.
- snapshots/: Immutable AI analysis history — never edit.
- approvals/: Immutable human decisions + audit logs — never mutate.

Non-negotiable rules
--------------------
1. Generator vs Operator
   - Generator writes only into `presenter/generated/` and `snapshots/`.
   - Operator updates only `presenter/index.html` with explicit operator approval (PR + signoff).

2. AI is advisory, humans decide
   - UI shows "AI recommends: X". Humans approve, override (with reason), or discard.

3. Data-ready gate
   - No interactive actions are enabled until the snapshot and presenter JSON are fully loaded and validated.

4. Submission invariant
   - A batch submission is blocked unless every `REVIEW_REQUIRED` item has a human decision. No partial submissions.

5. Audits and Immutability
   - `presenter/generated/presenter.json`, snapshots, and `approvals/audit.log` are append-only. If a mistake is made, create a new record rather than mutating history.

Operational notes
-----------------
- Overrides must include either: a reason selected from the UI or >10 characters of notes.
- Low confidence (<70%) recommendations are blocked for direct approve and require explicit override.
- Keep UI minimal: the operator's decision question should be: "Do I agree with the AI's routing?"

Change process
--------------
- Small UI copy fixes are acceptable but must be reviewed and approved by an operator.
- Any change to the generator that affects `presenter/generated/*` must include a smoke test showing the `TRUST_HEADER` and snapshot reference.

Contact
-------
For questions or to propose changes, open a PR and assign an operator reviewer (or contact the NAVI team lead).


Temporary uvx shim (containment)
-------------------------------
- Location: `bin/uvx.js` and `bin/uvx.cmd` (repo root: `D:\05_AGENTS-AI\01_RUNTIME\VBoarder\bin`).
- Purpose: non-destructive shim to prevent ENOENT when a missing `uvx` executable is spawned by services. This is a **temporary** containment; the root cause should be identified and fixed later.
- Behavior: logs every invocation to `logs/uvx-shim.log` (JSON lines) including timestamp, pid, ppid, parent process info (when available), cwd, and args. Exits with code `0` by default.
- Configurable exit code: set environment variable `UVX_EXIT_CODE` to change exit code (useful for testing failure paths).
- Removal: delete `bin/uvx.*` and remove the PATH entry added when installing the shim. Also remove the `logs/uvx-shim.log` file if desired.

> NOTE: This shim is intentionally simple and safe; it is not a replacement for the real `uvx` binary. Track follow-up work to either install the real binary or update the spawning code to avoid depending on `uvx`.

---

## Root-Cause Summary Template (fill after diagnosis) ✅

Use this template for the incident record. Keep it factual, time-scoped, and include exact evidence and remediation options.

- Title: Short incident title (e.g., "Unexpected spawns of missing binary 'uvx' causing ENOENT noise")
- Date/Time (first observed): YYYY-MM-DDTHH:MM:SSZ
- Reporter: @who or system

Root-cause hypothesis
---------------------
- Summary: One or two sentences describing the root cause once confirmed.
- Evidence: List of concrete evidence (ProcMon PIDs/timestamps, `uvx-shim.log` lines, `uvx-parent-trace.log` entries, correlated CSV rows, commit IDs, scheduled task name, service name, crontab entry, etc.). Include at least one timestamped correlation entry like:
  - ProcMon: Process Create at 2025-12-21T19:52:00Z → Parent PID=1234 (Parent name: spawner.exe) → CommandLine: "spawner.exe --run uvx"
  - uvx-shim.log: 2025-12-21T19:52:00.123Z pid=4321 ppid=1234 args=["--version"]

Impact
------
- Systems affected: list services/processes/nodes
- Symptom severity: low/medium/high (brief rationale)
- Volume: number of invocations per hour/day (if known)

Immediate remediation taken
--------------------------
- Containment: e.g., `bin/uvx` shim deployed (date/time, commit)
- Monitoring: logs/alerts added (e.g., watch job started or metrics placed)

Recommended next steps (options)
--------------------------------
- Option A: Install the real `uvx` binary on affected hosts (preconditions, verification steps)
- Option B: Patch the spawner to check for binary existence (include spawn-guard snippet reference) and gracefully degrade if missing
- Option C: Disable/remove the spawner (if determined to be orphaned) — include rollback plan
- For each option, include a short verification plan and an owner

Follow-up actions & owners
--------------------------
- Owner: @team or person
- Deadline: YYYY-MM-DD
- Notes: any further audits, tests, or documentation updates required (e.g., update this OPERATING_RULES entry)

Appendix
--------
- Links to raw artifacts (ProcMon PML/CSV, `ops/uvx-correlated.jsonl`, `logs/uvx-shim.log`, `logs/uvx-parent-trace.log`)
- Relevant commits, PRs, or configuration changes

> Use this template to populate a short, verifiable record and to drive the remediation decision. Keep the language factual — avoid speculation; include evidence and the specific next action with an owner.

---

Canonical runbook: starting NAVI & running Playwright tests
----------------------------------------------------------
Follow this exact sequence every time to avoid duplicate server spawns and intermittent failures:

Terminal 1 — NAVI
```powershell
cd D:\05_AGENTS-AI\01_RUNTIME\VBoarder
node runtime/current/mcp_server.js
```

Wait for:

```
=== NAVI READY ===
```

Terminal 2 — Tests
```powershell
cd D:\05_AGENTS-AI\01_RUNTIME\VBoarder
npx playwright test
```

Notes:
- No conditionals or special flags required.
- This aligns Playwright with the manual NAVI lifecycle and prevents Playwright from spawning servers that conflict with local processes.
