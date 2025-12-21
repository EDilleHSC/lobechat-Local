NAVI Presenter smoke tests (Playwright)

Prerequisites
- Node.js 18+ installed locally

Quick start
1. cd tests/smoke
2. npm ci
3. npx playwright install --with-deps
4. Ensure the NAVI presenter server is running and reachable at http://localhost:8005/presenter/
5. npm test

Notes
- Tests are intentionally non-destructive: the `/clear_exceptions` endpoint is stubbed during the test run.
- The tests rely on the presenter's DOM structure and IDs. If the operator UI changes, update the tests accordingly.
