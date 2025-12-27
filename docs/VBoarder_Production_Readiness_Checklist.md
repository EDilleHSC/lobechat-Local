# VBoarder Production Readiness Checklist

This checklist is used prior to production releases of NAVI and VBoarder components.

## Pre-release checks (additions for v2.1)
- [ ] Confirm `NAVI/config/routing_config.json` reflects 9 routing destinations: CFO, CLO, COO, CSO, CMO, CTO, AIR, EXEC, GYFOLE.
- [ ] Confirm `DESK` maps to `EXEC` and `DevOps` maps to `CTO` in the function-to-office mappings.
- [ ] Confirm orchestrator/sub-agent entries (COS, NAVI, DREW) are not treated as mailroom inbox destinations.
- [ ] **Normalization verification** — run a sample set of inputs (insurance, legal, invoice, ambiguous) and verify sidecars contain `ai_classification.normalization` with expected normalized department or `insurance_override` when applicable.
- [ ] Ensure sidecar writes are atomic (write `.tmp` then rename) and that the sidecar persisted contains final normalized content.
- [ ] Run full test suite (unit + integration) and confirm no flaky tests remain.

## Rollout
- [ ] Create branch, open PR with changes and include test output screenshots if large.
- [ ] Merge and deploy to staging, run e2e tests.
- [ ] Deploy to production during maintenance window.

---

*Updated: 2025-12-26 — add normalization verification (v2.1)*
