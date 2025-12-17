Canonical entrypoint: Process_Inbox

Purpose

Provide a simple, discoverable entrypoint for operators to run the mailroom (inbox processing) locally on main.

Locations

Primary (preferred):
- python core\intake\pipelines\triage_20251216_172245\mailroom_runner.py

Fallback:
- python pipelines\triage_20251216_172245\mailroom_runner.py

Repository shim (root):
- `Process_Inbox.bat` — attempts to invoke the primary path, falls back to the pipelines location, and uses `python` from PATH or `D:\Python312\python.exe` if present.

Usage

From the repository root on Windows:
- Double-click `Process_Inbox.bat`, or run in PowerShell/CMD:
  - `Process_Inbox.bat`

Notes & operational guidance

- This shim is intentionally conservative; it does not change runtime behavior or processing logic — it only invokes the canonical python runner.
- If `Process_Inbox.bat` cannot find the mailroom runner, it exits with code 1 and prints the expected locations.
- The canonical invocation for automation (CI, scheduled tasks) should be the primary python path above; update scheduled tasks to call the python command directly where possible.
