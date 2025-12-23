# Routing rules & audit (brief)

This document describes the routing rule IDs, the audit fields added to sidecars, and how to extend the routing logic in `decideRoute()`.

---

## 1) Routing Rule IDs ✅

| Rule ID | Fires When | Auto‑Route? | Example |
|---|---|---:|---|
| FINANCE_ENTITY_AUTOROUTE_V1 | `doc_type = Finance` and top AI entity ∈ `auto_route_entities` and top confidence ≥ `finance_auto_route_threshold` and no legal/conflict | ✅ | DDM bill → `DDM.Finance` |
| FINANCE_DDM_VENDOR_AUTOROUTE_V1 | `doc_type = Finance` and AI top entity `DDM` and vendor heuristic (keywords / account numbers) | ✅ | Loric Homes invoice → `DDM.Finance` |
| FINANCE_DESK_AUTOROUTE_V1 | `doc_type = Finance` and top AI entity `DESK` with confidence ≥ threshold and no conflict | ✅ | Utility bill → `DESK.Finance` |
| REVIEW_REQUIRED_LEGAL_V1 | Any `LEGAL`/`RISK` entity with confidence ≥ 0.5 | ❌ | Contract with legal text → `mail_room.review_required` |
| REVIEW_REQUIRED_CONFLICT_V1 | Two or more entities ≥ `conflict_top_entities_threshold` | ❌ | Ambiguous document (DESK + LHI) → `mail_room.review_required` |
| LEGACY_THRESHOLD_AUTOROUTE_V1 | Legacy fallback: top AI entity confidence ≥ `confidence_threshold` and enabled | ✅ | High-confidence legacy candidate |
| REVIEW_REQUIRED_DEFAULT_V1 | No auto-route rule matched | ❌ | Low confidence / unknown → `mail_room.review_required` |

---

## 2) Audit fields written to sidecars (.navi.json) 🔍

Every routed file now gains a `routing` object in its sidecar. Minimal example:

```json
"routing": {
  "route": "DDM.Finance",
  "autoRoute": true,
  "rule_id": "FINANCE_ENTITY_AUTOROUTE_V1",
  "rule_reason": "doc_type=Finance, signal=DDM, top_entity FINANCE (100%) >= 70%",
  "conflict_reason": null,
  "legal_blocked": false
}
```

Fields:
- `route`: Final route destination (string)
- `autoRoute`: boolean (true if auto-routed)
- `rule_id`: short stable identifier for the rule that determined the routing
- `rule_reason`: short human-readable explanation
- `conflict_reason`: e.g. `ENTITY_CONFLICT` or `LOW_CONFIDENCE` or `null`
- `legal_blocked`: true if LEGAL/RISK override prevented auto-route

These fields are intended to make post-hoc audits quick (no re-run of inference required).

---

## 3) How to add a new rule (safe pattern) 🛠️

1. **Implement logic** in `runtime/current/lib/router.js` inside `decideRoute()`.
2. **Pick a stable `rule_id`** (use a short UPPER_SNAKE_NAME with a version number, e.g. `FINANCE_LHI_AUTOROUTE_V1`).
3. **Populate `routing` fields** (rule_id, rule_reason, conflict_reason, legal_blocked) before returning.
4. **Add unit tests** in `runtime/current/test` that exercise the rule (call `decideRoute()` directly with synthetic `detectedEntities`).
5. **Run tests**: `cd runtime/current && npm test` and confirm CI passes.
6. **Update this README** to document the new `rule_id` and conditions.

Short checklist you can copy-paste into PR description:
- [ ] Logic added to `decideRoute()`
- [ ] Unit tests added/updated
- [ ] README updated with rule ID and brief description
- [ ] CI green

---

## 4) Configuration (where thresholds live) ⚙️

See `NAVI/config/routing_config.json` for the authoritative settings:
- `finance_auto_route_threshold`: e.g. `0.7` (entity confidence float)
- `conflict_top_entities_threshold`: e.g. `0.6`
- `auto_route_entities`: array of entity ids eligible for auto-route (e.g. `["DESK","DDM","LHI"]`)
- `legal_entities`: array of entity ids that block auto-route (e.g. `["LEGAL","RISK","CLO"]`)
- `confidence_threshold`: legacy integer percent (e.g. `70`)

---

## 5) Notes & best practices ✍️

- Prefer unit tests that call `decideRoute()` directly for deterministic coverage.
- Keep `rule_id`s stable across minor implementation tweaks — use `_V1` when first introduced.
- Add examples to sidecar fixtures when adding rules to make audits and tests more robust.

---

If you want, I can also add an `EXAMPLES.md` with the example sidecars from the 7 bills for reference. Let me know which docs or examples you'd like next.