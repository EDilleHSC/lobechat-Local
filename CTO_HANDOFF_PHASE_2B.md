# NAVI Mail Room — Phase 2B Completion Handoff

## Scope of Phase 2B

**Phase 2B objective:**
Take NAVI Mail Room from “routing logic wired but blind” to:

- OCR working end-to-end
- Entity detection feeding routing decisions
- Auto‑routing safely enabled for a subset of Finance docs
- Behavior covered by tests, CI, and docs

**Status:** Phase 2B is complete.

---

## What’s working now ✅

### OCR Pipeline (Local, Offline)
- Tesseract installed at `C:\Program Files\Tesseract-OCR\`.
- Poppler binaries + DLLs extracted into `runtime/current/tools/poppler/Library/bin`.
- `ocr_and_update_sidecars.js`:
  - Scans `NAVI/inbox` for eligible docs (PDFs, etc.), ignoring sidecars (`*.navi.json`).
  - Uses `pdftoppm.exe` (Poppler) to rasterize pages.
  - Uses Tesseract to OCR per page.
  - Concatenates text and writes it into `.navi.json` sidecars under `ai.*` keys.

### Entity Detection & Doc Typing
- OCR output is analyzed to produce `ai.entities` (e.g., `FINANCE`, `DESK`, `DDM`, `LHI`, `LEGAL`, `RISK`) and `doc_type` (e.g., `Finance`).
- Detected entities/weights now drive routing (rather than filenames only).

### Routing Policy & Audit Metadata
- `router.js` implements policy driven by `routing_config.json`:
  - `finance_auto_route_threshold`: `0.7`
  - `auto_route_entities`: `["DESK","DDM","LHI"]`
  - `legal_entities`: `["LEGAL","RISK","CLO"]`
  - `conflict_top_entities_threshold`: `0.6`

**Core rule IDs:**
- `FINANCE_ENTITY_AUTOROUTE_V1`
- `FINANCE_DDM_VENDOR_AUTOROUTE_V1`
- `FINANCE_DESK_AUTOROUTE_V1`
- `REVIEW_REQUIRED_LEGAL_V1`
- `REVIEW_REQUIRED_CONFLICT_V1`
- `LEGACY_THRESHOLD_AUTOROUTE_V1`
- `REVIEW_REQUIRED_DEFAULT_V1`

Each routed file’s sidecar includes a `routing` object, e.g.:

```jsonc
"routing": {
  "route": "DDM.Finance",                 // Final destination
  "autoRoute": true,                       // Whether auto-routed
  "rule_id": "FINANCE_ENTITY_AUTOROUTE_V1", // Which rule fired
  "rule_reason": "doc_type=Finance, signal=DDM, top_entity FINANCE (100%) >= 70%",
  "conflict_reason": null,                 // or ENTITY_CONFLICT, LOW_CONFIDENCE, etc.
  "legal_blocked": false
}
```

### Sidecar Recursion Bug – Fixed
- Both OCR pipeline and router: skip `*.navi.json` files as inputs.
- Nested `.navi.json.navi.json…` sidecars were cleaned and fixed.

### Tests & CI
- Unit tests (mocha + chai) in `runtime/current/test/` cover:
  - Finance auto‑route (`FINANCE_ENTITY_AUTOROUTE_V1`).
  - Legal override (`REVIEW_REQUIRED_LEGAL_V1`).
  - Conflict detection (`REVIEW_REQUIRED_CONFLICT_V1`).
- `package.json` updated with `test` script and devDependencies.
- `.github/workflows/nodejs-ci.yml` added — tests run on push/PR.

### Docs & Examples
- Repo-root `README.md` links to `runtime/current/README.md`.
- `runtime/current/README.md` documents rules, audit fields, and a reproducible meat-and-potatoes “how to run the mail room dry-run” snippet.
- `runtime/current/EXAMPLES.md` contains sanitized sidecar examples (auto-route + legal block).

---

## Real-World Dry‑Run Results (7 Bills) 🧪
**Input:** 7 real PDFs in `NAVI/inbox` (test copies)
**Pipeline:** OCR → detect entities/doc_type → router (dry-run)

**Outcome:**
- Auto‑routed to `DDM.Finance`: **3** files
- Kept in `mail_room.review_required`: **4** files

**Examples:**
- `Bill_09052025` → auto-routed (rule_id: `FINANCE_ENTITY_AUTOROUTE_V1`)
- `Bill_09172025` → review_required (rule_id: `REVIEW_REQUIRED_LEGAL_V1`, `legal_blocked: true`)

---

## Phase 2B Status
Phase 2B is complete. OCR, entity detection, routing policy, tests, CI, and docs are in place and verified on real data.

---

# Phase 2C — Proposed Plan (Operationalize mail room)

## Goals
Turn dry‑run into live routing and a durable, human‑review workflow:
- Turn decisions into actual moves (idempotent, safe).
- Define review queue & manual override process.
- Map logical routes to concrete office inboxes.

## Concrete Tasks
### 1) Enable Live Moves (Disable Dry‑Run in Controlled Way)
- Add config + CLI flags:
  - `enable_mailroom_routing: true/false` (already present; ensure honored)
  - `dry_run: true/false` (CLI override)
- Implement file move logic in `router.js`:
  - For `autoRoute=true`: move PDF + sidecar to target folder (e.g., `NAVI/sorted/DDM/Finance/INBOX/`).
  - For `autoRoute=false`: move to `NAVI/mail_room/review_required/` (or keep but list in review queue).
- Requirements:
  - Idempotent (no duplicate moves)
  - Safe on partial failures (use staging/temp moves or two‑phase approach)

### 2) Define & Implement the Review Queue
- Minimal review surface: a script (`scripts/list_review_queue.js` or `.ps1`) that:
  - Reads `.navi.json` under `mail_room/review_required`
  - Prints summary table: filename, doc_type, top_entity, route, rule_id, legal_blocked
- Manual override: document how to move a file (human moves PDF + sidecar to expected folder) and record approvals.

### 3) Map Routes → Office Inboxes
- Add `route_paths` mapping (either `routing_config.json` or `route_paths.json`):

```jsonc
"route_paths": {
  "DDM.Finance": "sorted/DDM/Finance/INBOX",
  "DESK.Finance": "sorted/DESK/Finance/INBOX",
  "LHI.Finance": "sorted/LHI/Finance/INBOX",
  "mail_room.review_required": "mail_room/review_required"
}
```

- Use this mapping in move logic so changes are config-driven.

## Out-of-Scope (Phase 2D+)
- Full review web UI / agent-driven review flows.
- Deep GTD / task integration.
- Cloud OCR or GPU acceleration.

---

## Handoff Summary
- Phase 2B: ✅ Complete
- Phase 2C: Next — implement live moves (idempotent + safe), review queue, and route→path mapping.

If you want, I can next help you:
- Design the route → filesystem path mapping for your actual `CFO_OFFICE`, `CLO_OFFICE`, etc. (I recommend we add a small config and a unit tested resolver), or
- Start implementing the `scripts/list_review_queue.js` plus a proof-of-concept `router` move step guarded behind `--dry-run` and `enable_mailroom_routing`.

---

*Prepared: Phase 2B handoff — NAVI Mail Room. Contact me if you want me to start Phase 2C work.*