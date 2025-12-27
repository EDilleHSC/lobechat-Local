# VBoarder Routing Handoff — Change Log

**Original:** VBoarder Routing Handoff (2025-12-23)
**Change:** 2025-12-26 → Consolidate office list to 9 offices (v2.1)

## Summary
- Reduced the set of routing destination mailboxes from **12 → 9**.
- **Removed** the following non-destination/orchestrator mailboxes: **COS**, **NAVI**, **DREW**.
- Confirmed that COS (Chief of Staff / Alex) is an orchestrator only and should not receive mail.
- Confirmed that DREW is a sub-agent under CTO (Tara) and does not have a public inbox; Tara delegates operational tasks to Drew.

## What changed
- Office list now contains only the 9 routing destinations:
  - CFO, CLO, COO, CSO, CMO, CTO, AIR, EXEC, GYFOLE
- Updated the canonical configuration (`NAVI/config/routing_config.json`) to map `DESK -> EXEC` and `DevOps -> CTO` and removed `COS`, `NAVI`, and `DREW` entries from `agents`.

## Insurance override (v2.1)
- Insurance documents now **always route to CFO** (domain override) when any of filename/content/AI reasoning indicates insurance.
- This is a deliberate safeguard to prevent insurance/premium documents from being misrouted to CTO or other offices.

## Notes for operators
- The system persists normalized `ai_classification` into sidecars; verify sidecars after processing to confirm `ai_classification.normalization` is recorded.
- If you rely on any scripts or dashboards that query NAVI offices, update them to remove COS/NAVI/DREW from the known offices set.

---

*Prepared: 2025-12-26 (v2.1 change log)*
