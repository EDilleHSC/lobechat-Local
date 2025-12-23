# Routing Examples (sanitized)

This file contains short, sanitized examples of sidecars produced by the pipeline to aid onboarding and debugging.

---

## 1) Auto‑routed example — `Bill_09052025` (sanitized)

Key fields:

```json
{
  "filename": "Bill_09052025_0001.pdf.testcopy",
  "detectedEntities": [ { "entity": "FINANCE", "confidence": 1.0 }, { "entity": "DESK", "confidence": 0.4286 } ],
  "entity": "DDM",
  "function": "Finance",
  "route": "DDM.Finance",
  "confidence": 100,
  "autoRoute": true,
  "routing": {
    "route": "DDM.Finance",
    "autoRoute": true,
    "rule_id": "FINANCE_ENTITY_AUTOROUTE_V1",
    "rule_reason": "doc_type=Finance, signal=DDM, top_entity FINANCE (100%) >= 70%",
    "conflict_reason": null,
    "legal_blocked": false
  }
}
```

Notes: this sidecar shows a clear Finance document where the DDM signal + AI top entity enabled auto‑routing.

---

## 2) Review‑required (legal) example — `Bill_09172025` (sanitized)

```json
{
  "filename": "Bill_09172025_0001.pdf.testcopy",
  "detectedEntities": [ { "entity": "FINANCE", "confidence": 1.0 }, { "entity": "LEGAL", "confidence": 0.5 } ],
  "entity": "HSC",
  "function": "Finance",
  "route": "mail_room.review_required",
  "confidence": 100,
  "autoRoute": false,
  "routing": {
    "route": "mail_room.review_required",
    "autoRoute": false,
    "rule_id": "REVIEW_REQUIRED_LEGAL_V1",
    "rule_reason": "Legal entity LEGAL 50% >= 50%",
    "conflict_reason": null,
    "legal_blocked": true
  }
}
```

Notes: legal signal at or above configured threshold causes the router to block auto‑routing and set `legal_blocked=true` so reviewers see why.

---

## How to use these examples
- Use these sanitized sidecars as fixtures for tests or for manual auditing.
- Add more examples as new rules are introduced.

---

If you'd like, I can add the remaining 5 real sidecars (redacted for PII) into this document as additional examples for onboarding.