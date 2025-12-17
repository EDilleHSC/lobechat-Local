# Clara (Presenter) — VBoarder

Clara = Clarification layer (single source of truth for what AIR decided).

Purpose
- Show what AIR decided (what just came in)
- Explain why (signals, reasons, confidence)
- Offer human actions: **Accept (Track)**, **Hold**, **Escalate**

Rules
- Clara is read-only with respect to NAVI state; it does not move files or perform processing.
- NAVI/inbox is a write-only mail slot for humans. Do not use it as a working folder.
- If a file remains in NAVI/inbox after processing, it means: dry-run, needs review, or unclassified.

Files that make up Clara v1
- `index.html` — entry point (LOCK)
- `template.html` — rendering template (LOCK)
- `presenter.py` — data injector (LOCK)
- `debug.log` — optional debug output

Files moved to graveyard (preserved)
- `index_debug_probe.html` → `NAVI/graveyard/index_debug_probe.html`
- `layout_test.html` → `NAVI/graveyard/layout_test.html`
- `template.html.backup` → `NAVI/graveyard/template.html.backup`

How to open Clara
- Desktop shortcut (created via `ops/create_clara_shortcut.ps1`) or
- Clara auto-opens after you run `Process_Inbox.bat` and processing completes successfully.

Beta-0 constraints
- No automated routing or processing from Clara.
- No email ingestion or department routing yet.
- Focus: clarity, trust, and reviewability.
