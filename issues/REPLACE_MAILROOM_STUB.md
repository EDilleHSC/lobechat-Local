Title: Replace Mailroom Stub with Production Mailroom Runner

Labels: beta1, routing, trust

Background
----------
We added a temporary Python mailroom stub (`runtime/mailroom_runner.py`) during Beta‑1 to restore routing and enable CI smoke tests. The stub satisfies the current stdout JSON contract used by the MCP server and tests.

Contract (stdout JSON)
----------------------
The mailroom runner MUST emit a single JSON object on stdout at completion with at least the following fields:

{
  "routed_to": "agent1",            // string name of the agent/department
  "routed_files": ["fileA.txt"],   // array of filenames routed
  "snapshot": "2025-12-17T20-00-00-000Z.json", // snapshot filename used
  "timestamp": "2025-12-17T20:00:00.000Z" // RFC3339/ISO timestamp (UTC)
}

Notes
-----
- Current tests (`mailroom_smoke.js`) depend on `routed_to` being present and the shape above.
- Any replacement must preserve the stdout JSON contract or update tests and MCP integration accordingly.

Acceptance criteria
-------------------
- Implement mailroom runner functionality to full spec (routing rules, durability, error handling).
- Preserve or explicitly evolve JSON contract and update tests if changed.
- Add unit and integration tests verifying routing behavior and trust propagation.

Risks & Considerations
----------------------
- Ensure mailroom does not alter the snapshot files (snapshots are intended to be immutable provenance records).
- Add logging for decisions and failures; avoid silent data loss.
- Consider `MAILROOM_STRICT` mode to fail the pipeline if mailroom fails (opt-in).

Owners
------
- Proposed owner: mailroom team / platform

Related
-------
- `runtime/mailroom_runner.py` (stub)
- `runtime/triage_*/tests/mailroom_smoke.js`
- `docs/BETA1_ARCHITECTURE.md`
