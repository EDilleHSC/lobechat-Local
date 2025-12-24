Title: Stabilize e2e tests, add CI smoke test, and streaming ZIP packages

Summary

This PR combines the following work:

- Stabilize Playwright e2e test runs by running the Presenter and NAVI reliably in CI using a wrapper script (`scripts/start_test_servers.js`) and using a dedicated presenter port to avoid NAVI/presenter ambiguity.
- Update Playwright configuration (`playwright.config.js`) to spawn the wrapper and wait for the presenter's health endpoint (now verified via `server` + `servedFrom` fields).
- Add a CI smoke test (`tests/ci/smoke.spec.js`) that validates `NAVI/approvals/run_start.json` (port, pid, started_at) so CI can fail fast if the presenter is not reachable.
- Improve presenter behavior: write `run_start.json` when `WRITE_PORT_FILE=1`, provide clearer `/health` metadata, and add logs to aid CI and local debugging.
- Implement streaming ZIP download and server-side ZIP cache for package batches (existing work retained): GET /api/packages/:pkg/download, cache status endpoints, and UI controls.
- Make small test and runtime fixes: structured router JSON output, more robust package-download checks, and Playwright test stability tweaks.

Why

E2E failures occurred because Playwright sometimes started NAVI (which proxies presenter assets) but not the presenter's API responsible for `/api/packages` and a presenter-style health payload. The two-port approach and the smoke check make the test runs deterministic and fail-fast.

What I tested locally

- `npm test` (unit + e2e): successful; one transient e2e test retried and passed. The smoke test passes locally when `run_start.json` is present.
- Verified presenter `run_start.json` write and health payload contains `server` with `bound` and `port`.

Next steps / Recommendations

1. Open this PR (draft) and run CI to verify unit, PowerShell (Pester) unit tests, and Playwright e2e run end-to-end in your CI environment.
2. After merge, monitor for flaky UI snapshot tests; where flakiness is observed, consider incremental timeout/poll increases or retry logic.
3. Optionally plan streaming/pagination for audit logs if they grow large (design note appended in PR comments).
4. Remove the temporary presenter asset-probe fallback in `tests/global-setup.js` after a stabilization period (e.g., 5 consecutive green CI runs).

Files of interest

- `scripts/start_test_servers.js`
- `playwright.config.js`
- `tests/global-setup.js`
- `tests/ci/smoke.spec.js`
- `scripts/serve_presenter.js`
- `runtime/router.js`
- `tests/e2e/*` (presenter health, package-download, router specs)

CI note

If you'd like I can also add a GitHub Actions job that runs the smoke test early as a preflight job (fail-fast). Let me know and I'll add it to this branch and the PR.
