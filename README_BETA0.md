# Beta‑0 Trust Loop — README

## Purpose
This document records the Beta‑0 trust contract: a minimal, deterministic verification loop that proves the system authoritatively generates the NAVI presenter artifact (`index.html`) and that the artifact contains a deterministic TRUST_HEADER for provenance.

## Scope
- Snapshot of inbox is taken by the MCP server and written to `NAVI/snapshots/inbox/` as immutable JSON files.
- The Presenter generator deterministically writes the canonical file at `D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\index.html`.
- The generated HTML contains a `<!-- TRUST_HEADER ... -->` block with deterministic fields.
- CI enforces a minimal smoke test and a trust-header-count test to prevent regressions.

## Completion conditions (Beta‑0)
- Presenter regenerates deterministically on every `/process` invocation.
- Canonical `index.html` contains a single `TRUST_HEADER` block.
- `TRUST_HEADER` contains valid `rendered_at` (UTC ISO8601), `snapshot_id` (snapshot filename), and `items_processed` (integer or `UNKNOWN`).
- CI (`.github/workflows/beta0-smoke.yml`) runs the smoke test and the header-count test on each push.

## Snapshot → Presenter flow
1. POST `http://localhost:8005/process` triggers the pipeline.
2. MCP writes a snapshot JSON to `NAVI/snapshots/inbox/` (immutable JSON with timestamped filename).
3. The Presenter regeneration routine writes `index.html` atomically (tmp file → rename) to the canonical path above.
4. The file includes a `TRUST_HEADER` block indicating provenance and freshness.

## TRUST_HEADER specification
A TRUST_HEADER is a single HTML comment block with three deterministic fields:
```
<!-- TRUST_HEADER
rendered_at: 2025-12-17T20:28:30.405Z
snapshot_id: 2025-12-17T20-28-30-404Z.json
items_processed: 2
-->
```
- `rendered_at` — UTC timestamp when the presenter file was written (ISO 8601, Z suffix).
- `snapshot_id` — the filename of the snapshot used to render (from `NAVI/snapshots/inbox/`).
- `items_processed` — number of items the snapshot contained (or `UNKNOWN` if unavailable).

## Local verification
- Manually: open `D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\index.html` in a browser and verify `TRUST_HEADER` in page source.
- Automated: run `node runtime/triage_*/tests/smoke_presenter.js` and `node runtime/triage_*/tests/test_single_trust_header.js`.

## CI
- Workflow: `.github/workflows/beta0-smoke.yml`
  - Starts MCP server on a Windows runner, waits for `/health`, runs smoke test and trust header count test, then cleans up.
- Passing CI on `main` is required to accept changes that could affect the trust loop.

## Release
This repository will be tagged `v0.1.0-beta0` to mark the Beta‑0 trust baseline. The tag documents the presence of deterministic presenter generation, the TRUST_HEADER standard, and CI enforcement.

---
For questions or to propose Beta‑1 features (mailroom restoration, routing, richer tests), open an issue or PR referencing this document.
