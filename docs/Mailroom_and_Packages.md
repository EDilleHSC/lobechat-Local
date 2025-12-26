# NAVI Mailroom & Packages (v2.0)

Summary
- Mailroom v2.0 routes processed files and packages to a fixed set of offices: **CFO, CLO, COO, CSO, CMO, CTO, AIR, EXEC, COS**.
- `filename_overrides` in `NAVI/config/routing_config.json` allow deterministic filename → office mappings (e.g., `Navi_` → `CTO`).
- Mailroom respects sidecars (`*.navi.json`) containing `route` or `function`, then filename overrides, then defaults to `EXEC`.

Important env & CI notes
- In CI, set `MAILROOM_PYTHON` to the path of `python` to ensure deterministic runs where multiple Pythons may exist.
- A small router→mailroom smoke job (`.github/workflows/e2e_router_mailroom.yml`) is present to validate the cross-runtime flow.

Package behavior
- Packages are created by the applier and follow the naming convention: `OFFICE_BATCH-<seq>_<timestamp>`.
- Packages are atomically written and copied into `NAVI/packages/` and then delivered by mailroom into `NAVI/offices/<OFFICE>/inbox/<package>`.

Testing & edge cases
- Unit tests exist for package delivery and filename override routing (`runtime/tests/test_mailroom_runner.py`).
- Add tests for missing sidecars, duplicate package names, and partial package content (edge-case tests are included in `runtime/tests/test_mailroom_edgecases.py`).

PR checklist (short)
- [ ] Verify unit tests pass locally (python tests + node unit tests)
- [ ] Confirm `MAILROOM_PYTHON` is set or python available on CI images
- [ ] Confirm router→mailroom smoke job passes on PR
- [ ] Check that packages written in `NAVI/packages` are delivered to correct office inboxes

Notes
- This doc is a concise runbook for reviewers and CI maintainers. Put questions or improvements in the PR description if anything looks risky.

Auto-processing (optional)
- A PowerShell watcher script is available at `scripts/enable_auto_processing.ps1`.
- The watcher monitors `NAVI/inbox` for new file drops and will:
  1. Run `node runtime/current/router.js --apply --force` to process new drops
  2. Run the mailroom via `MAILROOM_PYTHON` (or `C:\Users\PC\anaconda3\python.exe` if `MAILROOM_PYTHON` is not set)
  3. Log actions to `NAVI/logs/auto_process.log`
- To start the watcher run (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\enable_auto_processing.ps1
```

- The watcher is intended for local/dev usage. For production, run it as a managed background service and ensure `MAILROOM_PYTHON` is configured in environment variables.