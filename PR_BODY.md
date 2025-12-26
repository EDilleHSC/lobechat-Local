Restores a human-facing PRESENT page (HTML) generated from `NAVI/offices/*/inbox` and package manifests.

Key points:
- Adds `scripts/generate_present_page.py` which builds `NAVI/present/index.html` and `NAVI/present/present.json`.
- Hooks the generator into `runtime/mailroom_runner.py` so the present page regenerates after mailroom runs.
- Adds unit + integration tests:
  - `runtime/tests/test_generate_present_page.py` (unit + integration smoke)
- Adds present snapshot at `NAVI/present/index.html` to make review easier.

Notes:
- Polling watcher (`scripts/enable_auto_processing_polling.ps1`) is marked experimental and included separately.
- CI: Please ensure `MAILROOM_PYTHON` is configured on Windows runners or python is available on PATH to run mailroom steps in cross-runtime smoke jobs.

Testing:
- Run Python tests: `python -m pytest runtime/tests/test_generate_present_page.py`
- Run mailroom locally and verify `NAVI/present/index.html` updates.

Next steps (follow-up PRs):
- Improve PRESENT page UI (collapsible cards, links, reviewer forms)
- Add approval gate and CI integration for present page generation
- Harden and test polling watcher on Windows runners (experimental)
