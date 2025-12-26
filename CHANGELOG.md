## [Unreleased]

### Resilience
- Improved fault tolerance in batch logging system:
  - Added timeout-protected writer to prevent hangs (`writeBatchLogSafe`)
  - Introduced emergency audit fallback when log writing fails
- Routing and snapshots now succeed even under partial failure conditions
- Added regression test for router fallback behavior (low confidence = review_required)

### Changed
- Router CLI: added a safety guard preventing accidental live moves when `--apply` and `--dry-run` are combined without `--force`. This now exits with a non‑zero status and an explanatory message.

### Added
- Router CLI tests: `test/router_cli.spec.js` verifies:
  - `--apply --dry-run` without `--force` fails fast with an error.
  - `--apply --dry-run --force` is allowed and behaves as a dry‑run.
- Documentation updates in `runtime/current/README.md` and `.github/copilot-instructions.md` describing the safe run sequence and advanced `--force` usage.
