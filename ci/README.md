CI README — Runtime & Mailroom Requirements

Purpose
-------
This file documents CI and developer guidance for the Beta‑1 mailroom runner dependency (Python runtime) and how to verify it locally on Windows.

Why Python is needed
--------------------
- The mailroom runner is a Python program (`runtime/mailroom_runner.py`) responsible for routing snapshots to agents.
- CI runs a mailroom smoke test which requires a Python 3.9+ interpreter available in the runner environment.

Minimum version
---------------
- Python 3.9 or later (3.9+). Use a modern, supported Python version to ensure compatibility and security.

How to install on Windows
-------------------------
- Microsoft Store: Search and install "Python 3.10" or newer.
- Python.org: Download and run the official installer from https://www.python.org/downloads/windows/.
  - When installing from python.org, check "Add Python to PATH" to simplify usage.

How to verify Python is on PATH
-------------------------------
Open PowerShell or CMD and run:

- python --version
- python -c "import sys, json; print(sys.version.split()[0])"
- py -3 --version   # if using the py launcher

If any of these commands print a version >= 3.9 and `python -c "import json"` runs without error, you're good.

CI behavior when Python is missing
----------------------------------
- The `runtime-restore` workflow runs a runtime check step that verifies Python >= 3.9 and `import json`.
- If the runtime check fails, CI job exits early with a clear error message explaining how to install Python and how to add it to PATH.
- This prevents mailroom smoke tests from running on unsuitable runners, reducing noise and misleading failures.

Developer tips
--------------
- For local development, consider installing Python from the Microsoft Store (fast) or using the official installer to get the `python` command on PATH.
- Use virtual environments for isolation: `py -3 -m venv .venv` then `.\.venv\Scripts\Activate.ps1` in PowerShell.
- The repository includes `runtime/triage_*/tests/runtime_restore_check.js` — use it to validate your environment prior to creating PRs that touch mailroom or routing logic.

Contact
-------
If you have issues with the runtime verification or CI, open a ticket and tag `beta1`, `ci`, `infra`.
