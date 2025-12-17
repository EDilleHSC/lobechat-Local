VBOARDER STRUCTURE — LOCK v1

This document defines the stable, enforceable folder structure for VBoarder (v1). It is a short, strict map — follow it until further notice.

ROOT (READ-MOSTLY)
- README.md
- VBOARDER_CANON.md
- STRUCTURE.md
- Process_Inbox.bat (shim only)
- start_mcp_server.bat (shim only)
- node_modules/ (ignore)
- .git/ (ignore)
- runtime/
- pipelines/
- presenter/
- NAVI/
- ops/
- configs/
- tests/
- logs/
- _graveyard/

RULE: Nothing executes from the project root. Root contains navigation and entrypoint shims only.

runtime/ (ONLY THINGS THAT RUN)
- Contains processes that bind ports and are managed (e.g. mcp_server.js)
- PM2 configs live here
- No data files
- No HTML renders

pipelines/ (AIR + processing)
- AIR, mailroom, scanners and pipeline code
- Reads from NAVI/inbox
- Writes to NAVI/state and NAVI/DONE/WAITING/ACTIVE
- Never listens on ports or serves HTML

NAVI/ (GTD state + data)
- inbox/, ACTIVE/, WAITING/, DONE/, HOLD/, REVIEW/
- archive/ (cold storage)
- snapshots/ (immutable history)
- logs/
- state/ (e.g. air_output.json, system_status.json)
- policies/ (operational protocols)

RULE: NAVI is authoritative state. Nothing may write outside NAVI except pipelines that are explicitly allowed to modify NAVI state.

presenter/ (READ-ONLY VIEW)
- HTML + static templates
- presenter.py (rendering logic) reads AIR output and writes to presenter HTML targets
- Must not change workflow state

_graveyard/ (SACRED TRASH)
- Deprecated experiments, archives, and unclear items
- No execution
- No deletions; only moves and long-term storage

ENFORCEMENT
- Freeze structure for 1–2 days after this commit: no moves, only observations
- Changes that add runtime or pipeline code to root are disallowed (CI check to follow)
- Compatibility shims at root are allowed and must be trivial (forwarders only)

NEXT ACTION
- This file is the official v1 lock. Confirm and we will (optionally) add CI checks and documentation that prevent future root mutations.
