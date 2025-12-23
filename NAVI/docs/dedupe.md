# NAVI Dedupe Guard

Purpose
-------
This document describes the exact-content deduplication guard recently added to the NAVI routing pipeline. The guard computes a SHA‑256 hash for each file discovered by the router and uses an append-only registry (`NAVI/metadata/seen_files.jsonl`) to detect files that have already been seen.

Config
------
Add a `dedupe` section to your `NAVI/config/routing_config.json` (or the NAVI-root considered by runtime) to control behavior.

Example:

```json
{
  "dedupe": {
    "enabled": true,
    "policy": "flag"
  }
}
```

Fields:
- `enabled` (boolean): If false, dedupe checks are skipped and the system behaves as before.
- `policy` (string): One of `flag` (default), `skip`, or `tag`:
  - `flag`: Mark sidecar with `routing.duplicate = true` and `routing.duplicate_of` but route normally.
  - `skip`: Mark sidecar and do **not** apply routing (route will be set to `mail_room.duplicate_skipped`); good for aggressive dedupe environments.
  - `tag`: Mark sidecar and add `routing.reason_code = "DUPLICATE_DETECTED"`, then route normally.

Behavior summary
----------------
- The router computes a SHA‑256 hash of a file at discovery and checks `NAVI/metadata/seen_files.jsonl` for an existing entry.
- If an entry exists, the router adds duplicate metadata to the file's sidecar and then acts according to configured `policy`.
- If the hash is new, the router appends an entry to `seen_files.jsonl` with: `hash`, `path` (relative to NAVI root), `filename`, and `first_seen` timestamp.

Registry format
---------------
`NAVI/metadata/seen_files.jsonl` is an append-only newline-delimited JSON file. Each line is a JSON object like:

```json
{ "hash": "<sha256>", "path": "inbox/invoice.pdf", "filename": "invoice.pdf", "first_seen": "2025-12-23T12:00:00Z" }
```

Rollout steps (recommended)
---------------------------
1. Enable dedupe in `routing_config.json` with `policy: "flag"`. This will detect duplicates and surface them in sidecars without changing routing behavior.
2. Run the backfill script to populate the registry from existing `inbox/` and `sorted/`
   - `node scripts/backfill_seen_files.js --dry-run` to preview changes
   - `node scripts/backfill_seen_files.js` to append missing registry entries
3. Operate for a few days while monitoring sidecars and audit logs. If acceptable, decide whether to move to `policy: "tag"` or `policy: "skip"`.
4. If you choose `skip`, set `policy: "skip"` and monitor carefully (skip behavior avoids applying routing for duplicates).

Backfill & ops
---------------
A helper script `scripts/backfill_seen_files.js` is provided to scan `NAVI/inbox` and `NAVI/sorted` and append any missing hashes to `NAVI/metadata/seen_files.jsonl`. The script supports `--dry-run` and `--navi-root` (or use `NAVI_ROOT` env) and is idempotent — it will not add duplicate registry lines.

Notes & caveats
----------------
- This dedupe guard uses exact content hashing (SHA‑256). It will not detect near-duplicates such as rescans, cropping, or OCR-only differences. Consider a Phase 2 fuzzy dedupe (OCR + embedding/MinHash) if you need resilience to modified scans.
- Registry growth: `seen_files.jsonl` is append-only and can grow over time. If needed, consider periodic compaction or migrating to a small DB.
- Privacy/retention: the registry stores only file hashes and minimal metadata; adopt retention rules as needed for compliance.

Questions or requests for a Phase 2 fuzzy dedupe? Open an RFC and I can propose options and an estimate.