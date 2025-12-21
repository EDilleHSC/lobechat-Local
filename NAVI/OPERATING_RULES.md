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