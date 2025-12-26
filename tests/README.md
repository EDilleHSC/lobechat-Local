Tests: Test server strict mode

- The test harness spawns an isolated MCP server per test (ephemeral port, isolated NAVI_ROOT).
- To enforce strict mode in CI, set: `TEST_SERVER_STRICT=1`.
  - In strict mode the helper refuses to run against a non-test `NAVI_ROOT` (fails fast).
  - Helps avoid accidental runs against a developer or production NAVI tree.
- Local dev can run without `TEST_SERVER_STRICT=1` if they need more relaxed behavior for debugging.
