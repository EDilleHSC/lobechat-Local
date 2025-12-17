VBOARDER STRUCTURE — LOCK v1

This document defines the stable, enforceable folder structure for VBoarder (v1). It is a short, strict map — follow it until further notice.

ROOT (READ-MOSTLY)
- README.md
- docs/ (contains VBOARDER_CANON.md, STRUCTURE.md, README_PRODUCTION.md)
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

core/ (Primary system logic)
- core/intake/
  - pipelines/ (AIR, mailroom, scanners)
  - NAVI/ is authoritative state and remains at `NAVI/` (do not move without planning)
  - Entry scripts: `Process_Inbox.bat`, `Process_Collection.bat` (shims remain at root)

- core/presenter/
  - presenter/ (Clara static renderer)

- core/runtime/
  - Contains processes that bind ports and are managed (e.g. mcp_server.py/js)
  - Start scripts and server wrappers

pipelines/ (legacy and moved content)
- Pipeline source code has been relocated to `core/intake/pipelines/`
- `pipelines/` at project root now contains placeholders/README only

NAVI/ (GTD state + data)
- inbox/, ACTIVE/, WAITING/, DONE/, HOLD/, REVIEW/
- archive/ (cold storage)
- snapshots/ (immutable history)
- logs/
- state/ (e.g. air_output.json, system_status.json)
- policies/ (operational protocols)

NOTE: Mailroom invariant — destination paths that pipelines route to (e.g. `ACTIVE/`, archive subfolders, `REFERENCE`) must be directories. Files may not share the same path as routing targets.

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
- Changes that add runtime or pipeline code to root are disallowed (CI guard enforces this)
- Compatibility shims at root are allowed and must be trivial (forwarders only)

CI GUARD
- A GitHub Actions workflow (`.github/workflows/root-guard.yml`) runs on push/PR and executes `scripts/check_root_guard.py` to detect disallowed files in root.
- To allow an intentional exception, add `# ROOT_EXCEPTION_OK` to the file and open a PR with justification in the description.

NEXT ACTION
- This file is the official v1 lock. Confirm and we will (optionally) add CI checks and documentation that prevent future root mutations.

MIGRATION NOTE
- Files originally located at root that are processing code have been moved into `pipelines/moved_from_root` and `runtime` as part of an initial cleanup. See git history for original content.
