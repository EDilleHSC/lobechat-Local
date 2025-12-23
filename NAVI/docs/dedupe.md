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

Rollout Plan
----------------
This dedupe layer is designed to be safe by default and rolled out in stages.

Stage 0 – Default (flag-only, no behavior change)
Goal: Turn on visibility for duplicates without changing routing behavior.

Config:
Ensure dedupe config is present (example):

```json
{
  "dedupe": {
    "enabled": true,
    "policy": "flag"
  }
}
```

Behavior:
- Router computes SHA-256 hashes and consults `NAVI/metadata/seen_files.jsonl`.
- For duplicates, sidecars are marked:

```json
{
  "routing": {
    "duplicate": true,
    "duplicate_of": {
      "hash": "...",
      "first_seen": "...",
      "seen_path": "..."
    }
  }
}
```

- Routing still proceeds normally (no files are skipped).

What to monitor:
- How many duplicates are being flagged.
- Whether any of them are "legit repeats" the business wants to keep processing vs. accidental re-uploads.

Recommended: Run in this mode for a while before changing behavior.

Stage 1 – Backfill the registry (optional but recommended)
Goal: Seed the dedupe registry with hashes of existing files so old content is recognized as "already seen." 

Dry-run first:

```bash
node scripts/backfill_seen_files.js --navi-root "D:/NAVI" --dry-run --limit 100
```

Confirms which files would be recorded without touching `seen_files.jsonl`.

Run for real (small batches):

```bash
node scripts/backfill_seen_files.js --navi-root "D:/NAVI" --limit 1000
```

- Can be run multiple times; it is idempotent and only appends missing hashes.
- Typical targets: `NAVI/sorted/**`, `NAVI/archive/**`, and any long-lived storage where you expect re-uploads.
- You can schedule backfill as a low-priority maintenance task until you’re happy with coverage.

Stage 2 – Consider policy changes (flag → skip or tag)
Goal: Once you trust the data, you can change how the router reacts to duplicates.

Dedupe config supports these policies:
- `flag` (default, safest): Mark duplicates in sidecars but still route.
- `skip`: Mark duplicates and do not route them at all (route becomes `mail_room.duplicate_skipped`).
- `tag`: Mark duplicates and add a tag / reason code (`DUPLICATE_DETECTED`) while still routing.

Example config to switch to skip:

```json
{
  "dedupe": {
    "enabled": true,
    "policy": "skip"
  }
}
```

Recommended process:
- Stay on policy `flag` until:
  - You’ve backfilled at least your main `sorted` and `archive` trees.
  - You’ve reviewed summarizer runs and are confident what "duplicate" means in practice.
- If you want more visibility without behavior change, consider `tag` first.
- Only move to `skip` when you are confident skipping duplicates is safe for the environment.

After changing policy:
- Monitor logs closely for "skipped due to duplicate" events.
- Confirm no critical workflows rely on re-processing the same document content.

Stage 3 – Ongoing operations
- Periodically re-run `backfill_seen_files.js` when large archives are imported or new historical folders are added.
- Use `summarize_decisions.js` and log scans to track how many duplicates are flagged and to inform policy tuning.

## Quick Checks

### Count total entries in the registry

```bash
# PowerShell
(Get-Content NAVI/metadata/seen_files.jsonl | Measure-Object -Line).Lines

# Bash
wc -l < NAVI/metadata/seen_files.jsonl
```

### Find duplicates flagged by the router

```bash
# PowerShell: search sidecars for "duplicate": true
Get-ChildItem -Recurse -Filter "*.navi.json" | Select-String '"duplicate"\s*:\s*true' | Select-Object -ExpandProperty Path

# Bash: grep recursive for duplicate flag
grep -R "\"duplicate\"\s*:\s*true" -n NAVI | sed -e 's/:.*//g' | sort -u
```

### Check recent backfill activity

```bash
# PowerShell: tail the registry to see latest appends
Get-Content NAVI/metadata/seen_files.jsonl -Tail 10

# Bash: tail
tail -n 10 NAVI/metadata/seen_files.jsonl
```


Backfill & ops
---------------
A helper script `scripts/backfill_seen_files.js` is provided to scan `NAVI/inbox` and `NAVI/sorted` and append any missing hashes to `NAVI/metadata/seen_files.jsonl`. The script supports `--dry-run` and `--navi-root` (or use `NAVI_ROOT` env) and is idempotent — it will not add duplicate registry lines.

Notes & caveats
----------------
- This dedupe guard uses exact content hashing (SHA‑256). It will not detect near-duplicates such as rescans, cropping, or OCR-only differences. Consider a Phase 2 fuzzy dedupe (OCR + embedding/MinHash) if you need resilience to modified scans.
- Registry growth: `seen_files.jsonl` is append-only and can grow over time. If needed, consider periodic compaction or migrating to a small DB.
- Privacy/retention: the registry stores only file hashes and minimal metadata; adopt retention rules as needed for compliance.

Questions or requests for a Phase 2 fuzzy dedupe? Open an RFC and I can propose options and an estimate.