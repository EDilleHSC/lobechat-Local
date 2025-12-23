# Routing rules & audit (brief)

### Baseline: NAVI Mail Room v2 (Phase 2B/early 2C) ✅

- This branch (`main`) is the **canonical implementation** of:
  - OCR (Tesseract + Poppler)
  - NAVI mail room routing (Phase 2B)
  - C‑Suite office skeletons and `route_paths` (Phase 2C foundation)
- Older prototypes and branches have been archived or moved to `__archive`.
- Future work should branch from `main` only.

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

---

### How to run the mail room dry-run

From `runtime/current`:

```bash
# 1. Run OCR + update sidecars for inbox PDFs
node tools/ocr_and_update_sidecars.js \
  --inbox "../../NAVI/inbox" \
  --poppler-path "./tools/poppler/Library/bin" \
  --tesseract-path "C:/Program Files/Tesseract-OCR/tesseract.exe"

# 2. Run the router in dry-run mode (no file moves)
node router.js \
  --config "./routing_config.json" \
  --navi-root "../../NAVI" \
  --dry-run
```

This will:
- OCR all eligible PDFs in `NAVI/inbox` and write/update `.navi.json` sidecars with `ai.*` fields and `routing.*` audit metadata
- Print a summary of routing results (e.g., `DDM.Finance: 3`, `mail_room.review_required: 4`)

Notes:
- Adjust the `--poppler-path` and `--tesseract-path` arguments as needed for your environment
- The recommended safe sequence is:
  1. Preview: `node router.js --dry-run --limit 5`
  2. Apply (with confirmation): `node router.js --apply --limit 5` (type `yes` when prompted)
- Advanced (testing only): to exercise apply code paths while keeping the run read-only, use:
  `node router.js --apply --dry-run --limit 5 --force` (this is treated as a dry-run and will not move files)
- If you want to persist moves (not a dry-run), update `router.js` to remove `--dry-run` behavior or use the appropriate flag/entrypoint in your deployment

---

If you'd like, I can also add a small `scripts/run_mailroom_dryrun.ps1` wrapper that runs these commands end-to-end and captures a summary output.

### CFO worker (scripts/cfo_worker.js)

- Purpose: Process NAVI/offices/CFO_OFFICE/inbox into processed/ and emit a ledger JSON per doc.
- Usage:
   = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"
  node scripts/cfo_worker.js
- Notes:
  - NAVI_ROOT is required (fail-fast).
  - Worker is idempotent — it skips files already in processed/.

---

## Applying human review decisions ("Secretary" script) 🔧

The `scripts/apply_human_decisions.js` helper reads a saved human review file (created by the reviewer UI under `NAVI/approvals/review_decisions_*.json`) and executes a safe, idempotent mapping of decisions to filesystem actions.

Usage:

- Dry-run (safe, default):
  node scripts/apply_human_decisions.js --file path/to/review_decisions.json

- To actually perform file moves/copies:
  node scripts/apply_human_decisions.js --file path/to/review_decisions.json --apply --force

Important safety notes:
- `--apply` will not run unless `--force` is also supplied. This prevents accidental destructive runs from automation or interactive shells.
- The script is idempotent: it copies a canonical storage file (from `route_paths` in `NAVI/config/routing_config.json`) and writes an office inbox copy, skipping duplicates if destination already exists.
- A `TRASH` or `discard` decision moves the source file to `NAVI/archive/trash`.
- For testing, you can override the NAVI root with the `REVIEW_NAVI_ROOT` environment variable (useful in CI or local tests).

Tests:
- Unit/integration tests were added at `runtime/current/test/apply_human_decisions.spec.js` to cover dry-run and `--apply --force` behavior (route and discard cases).

If you'd like, I can add a PowerShell wrapper to run the script against a set of review files and produce a short summary report (counts).
