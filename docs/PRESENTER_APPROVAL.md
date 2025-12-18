Presenter UI approval and lock-down

Overview
--------
We now use an operator-approved UI template that is *not* overwritten by the presenter generator.

What changed
------------
- `NAVI/presenter/index.html` is now the approved UI and contains a banner: "This UI is operator-approved; data is advisory only." The page fetches data from `NAVI/presenter/generated/presenter.json` and updates content dynamically.
- The presenter generator (`NAVI/presenter/presenter.py`) no longer overwrites `index.html`. Instead it writes `NAVI/presenter/generated/presenter.json` and a preview `NAVI/presenter/generated/index.html`.
- Added lightweight tests:
  - `runtime/triage_20251216_172245/tests/validate_presenter_json.js` — ensures `generated/presenter.json` exists and contains `trust_header` and `items`.
  - `runtime/triage_20251216_172245/tests/presenter_no_overwrite.test.js` — static check that `presenter.py` does not write to `self.output_path` (helps prevent accidental overwrite of the approved template).

Operator guidance
-----------------
- To update the approved UI, edit `NAVI/presenter/index.html` (operator review + PR required).
- The generator will write `NAVI/presenter/generated/presenter.json`; the UI reads that file. CI will validate `presenter.json` structure via the `validate_presenter_json` script.

Next steps / CI
---------------
- Added CI steps in `.github/workflows/runtime-restore-check.yml` that run `node runtime/**/tests/validate_presenter_json.js` and `node runtime/**/tests/presenter_no_overwrite.test.js` as part of the runtime restore check (label: Presenter Approval Guard).
- Optionally add a required status check that prevents merges that modify `NAVI/presenter/index.html` without operator approval.
