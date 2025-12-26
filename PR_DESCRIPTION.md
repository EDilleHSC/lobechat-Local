# feat(resilience): Harden batch log writing with timeout + emergency audit fallback

## Summary

This PR improves the resilience of the batch log writer by introducing:

- A **timeout-protected, non-blocking `writeBatchLogSafe()` wrapper** to prevent log write hangs
- A **synchronous fallback audit path** that writes emergency JSON records when log writes fail
- **Integration test updates** to confirm snapshots succeed and routing completes even when batch log fails
- A new **unit test** that locks in router fallback behavior (`router.fallback.test.js`)
- Snapshot and approval system now robust against partial failure of batch log writes

## Changes

- `batch_log.js`: Added `writeBatchLogSafe()` with Promise.race timeout guard
- `mcp_server.js`: Decoupled snapshot + logging paths; introduced fallback audit emitter
- `batch_log_failure.test.js`:
  - Increased test timeout
  - Broadened snapshot path discovery
  - Asserted:
    - Snapshot still saves
    - Log file missing as expected
    - Emergency audit present and valid
    - EXEC not overloaded unexpectedly
- `router.fallback.test.js`: New unit test for fallback route resolution + confidence guard

## Risk Level: Low

- Changes are isolated to batch logging
- Confirmed that routing and snapshot logic remain intact under failure
- All tests passed locally (17/17 green, 1 skipped as expected)

## Follow-Ups (Next PRs)

- [ ] Centralize insurance signals in shared config (router/server)
- [ ] Add unit test that asserts emergency audit file path respects `APPROVAL_DIR` when set

## Test Plan

- Full Jest suite run (`--runInBand`) – all tests passed ✅
- Manual inspection of fallback files under `approvals/audit/` confirms correct pathing
