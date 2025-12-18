# Agent Receipt / Acknowledgement Specification (Beta‑1)

Purpose
-------
Defines the schema, semantics, and CI validation rules for agent receipts (`<file>.receipt.json`) to prove an agent accepted or rejected a routed file.

Quick summary
-------------
- Every delivered file SHOULD be followed by a receipt written by the agent after validation.
- Receipts are written atomically to `NAVI/agents/<agent>/receipts/<file>.receipt.json`.
- CI checks will assert the presence of receipts and valid schema for successful deliveries.

Schema (required fields)
------------------------
- `receipt_id` (string, UUID)
- `routing_id` (string) — matches router's `routing_id`
- `filename` (string) — delivered filename
- `received_at` (string, ISO8601)
- `received_by` (string) — agent id
- `status` (string) — one of: `accepted`, `rejected`, `quarantined`
- `notes` (string, optional)
- `contract_version` (string)

Example receipt
----------------
```json
{
  "receipt_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "routing_id": "ad9443a8-c1da-48a3-bc38-e87a03d42350",
  "filename": "route_smoke.txt",
  "received_at": "2025-12-17T21:16:36.000Z",
  "received_by": "agent1",
  "status": "accepted",
  "notes": "Checksum validated",
  "contract_version": "1.0"
}
```

Agent behavior
--------------
- After the agent validates `checksum_sha256` and `trust_header`, it MUST create the receipt.
- If validation fails, the agent MUST set `status` to `rejected` or `quarantined` and include `notes` explaining why.
- Receipts should be written atomically and ideally signed (HMAC) in future versions.

CI Acceptance criteria
----------------------
- Add a CI smoke test that confirms for each routed file:
  - a receipt exists in `NAVI/agents/<agent>/receipts/<file>.receipt.json` and validates against the schema
  - `status` is `accepted` for successful flows

Versioning
----------
- Start at `contract_version: 1.0`. Breaking changes require a major bump and migration steps.
