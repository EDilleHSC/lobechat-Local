# Agent Contract (Beta‑1)

Purpose
-------
Define the format, placement, and verification rules for files delivered to agents by the mailroom/router so that trust metadata and integrity are preserved end-to-end.

Inbox Structure
---------------
Repository canonical structure:
```
NAVI/
  agents/
    <agent-name>/
      inbox/         # files delivered for processing
      processed/     # files processed (archive)
      receipts/      # processing receipts (optional)
```

Delivery Pattern
----------------
- Mailroom/router copies files to `NAVI/agents/<agent>/inbox/<filename>`.
- For each delivered file, the router MUST also provide an accompanying metadata JSON file `<filename>.meta.json` containing the routing and integrity metadata.

Metadata contract (`<filename>.meta.json`)
-----------------------------------------
Required fields:
- `filename` - original filename (string)
- `routing_id` - UUID or unique token for the routing action (string)
- `routed_from` - snapshot filename used for routing (string)
- `routed_at` - UTC ISO8601 timestamp for the routing action (string)
- `routed_to` - agent name used as delivery destination (string)
- `checksum_sha256` - hex string of SHA-256 of the delivered file (string)
- `trust_header` - the `TRUST_HEADER` block value (string) OR the snapshot id used to compute it
- `rules_applied` - array of rule identifiers that led to this routing decision (array)

Example:
```json
{
  "filename":"invoice-123.txt",
  "routing_id":"b8a8f0d2-...",
  "routed_from":"2025-12-17T21-00-23-728Z.json",
  "routed_at":"2025-12-17T21:01:00.123Z",
  "routed_to":"accounts-payable",
  "checksum_sha256":"e3b0c442...",
  "trust_header":"2025-12-17T21:01:00.000Z|2025-12-17T21-00-23-728Z.json|3",
  "rules_applied":["rule-invoice-detected"]
}
```

File integrity & trust
----------------------
- Agent code must verify `checksum_sha256` matches the downloaded file before processing.
- The presence of `trust_header` or reference to the snapshot ensures a provenance chain from snapshot -> mailroom -> agent.
- Agents should write a receipt file in `receipts/` containing processing status and timestamp, optionally including an agent-signed (HMAC) confirmation.

Processing semantics
--------------------
- Processing must be idempotent — repeated deliveries with the same `routing_id` should be harmless.
- If an agent cannot verify checksum or trust metadata, it should move the file to `failed/` and write a receipt with an error code.

Receipts
--------
A receipt should contain at minimum:
- `routing_id`
- `filename`
- `processed_at`
- `status` (`ok` or `error`)
- `error_message` (optional)

CI & Tests
----------
- Add tests that simulate mailroom->router->agent flow and assert the agent receives both file and `<file>.meta.json`, verifies checksum, and reads `trust_header`.

Versioning & Evolution
----------------------
- This contract is Beta‑1; breaking changes require updated tests and PRs that call out migration steps.

---
