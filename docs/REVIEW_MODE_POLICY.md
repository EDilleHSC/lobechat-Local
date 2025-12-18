Review Mode → Autonomy Policy (Beta‑1)

Purpose
-------
Defines the minimal criteria and process to move from manual "trusted review" mode to "autonomy" (agent automated action) for file routing.

Key definitions
---------------
- Review Mode: Human drops file; system routes; humans manually review presenter and receipts before agents act.
- Autonomy Mode: Agent may act on received files without manual intervention, provided acceptance criteria are satisfied.

Transition Criteria (must all be true)
-------------------------------------
1. Schema enforcement: CI shows green runs for metadata validation (AJV) for N consecutive runs (recommended N=3).
2. Receipts: Agents produce `status: accepted` receipts for test flows and receipts validate against schema.
3. Monitoring & Alerts: Quarantine/monitoring pipeline is in place and alerts on `rejected` or `quarantined` receipts.
4. Rollback plan: Documented manual rollback steps and an automated quarantine mechanism.
5. Operational readiness: Owners, runbooks, and escalation contacts are listed and trained.

Procedure to switch
-------------------
1. Run audit: confirm CI runs, receipts passing, and monitoring enabled.
2. Set branch protection: require AJV validation check as a required status for merges.
3. Announce change and schedule a soft launch with limited scope (a small subset of workflows).
4. Observe for a burn-in period (metric-driven, e.g., 48h with operational metrics).

Rollback conditions
-------------------
- Rapid increase in `quarantined` receipts
- Any unexplained data integrity failures (checksum mismatches)
- Missing or invalid receipts for accepted files

Notes
-----
- Until this policy is satisfied the system remains in "trusted review" mode (no agent autonomous actions permitted).
- This policy is intentionally conservative: trust first, autonomy later.
