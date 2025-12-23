# KB Ingest — Operator SOP (One Screen)

**Title:** KB Ingest Review — What am I deciding?

**Goal (one sentence):** Decide whether this run becomes part of the canonical Knowledge Base.

**The only question:** "Does this belong in the Knowledge Base?"

Allowed actions (one-screen):
- ✅ Approve to KB (default)
- 📝 Edit / Tag (optional)
- 🚫 Reject (rare; requires reason)
- ⚠️ Escalate to Legal (if risk flags indicate PII/sensitivity)

Quick checklist (60–90 seconds):
1. Confirm source & integrity (filenames, sizes, readable content/OCR)
2. Review AI summary & top excerpts
3. Check similar KB results for duplicates
4. Check risk flags and sensitivity
   - If sensitive/legal → Escalate (locks approval until signoff)
5. Decide: Approve / Edit+Approve / Reject (select reason)
6. Optional short note (1–2 lines) for audit

Mandatory rules / non‑goals (explicit):
- **No confidence-based auto-decisions.** Confidence is informational only.
- **You are acknowledging, not judging** priority or routing.
- **Do not discard lightly.** Rejections require a stated reason.
- **Escalate** for legal/PII/sensitive flags.

UI mapping (minimal):
- Banner (non-dismissable): **"KB Ingest Mode — Human review required"**
- Primary CTA: Approve (green, default)
- Secondary: Edit/Tag (pencil)
- Reject: requires explicit reason
- Escalate to Legal: when risk flags present
- Side panels: AI summary, top excerpts, suggested tags, similar KB hits, risk flags, original files

Acceptance criteria for UI and tests:
- KB mode must show banner and `kb_mode: true` in presenter JSON
- KB mode must never auto-route any files (auto_routed == 0)
- Approve action requires a human POST to `/approval` with reviewer metadata

Escalation & audit:
- Legal escalation creates `LEGAL_REVIEW` substate and notifies Legal via webhook/email
- All state transitions record `{ userId, timestamp, notes, action }`
- Approved KB artifacts must include canonical metadata and unique IDs

Operational notes:
- Target review time: 30–90s per item for typical content
- Default operator action: Approve (reduces backlog)
- Recommended training: 10–15 minute walkthrough with ~10 sample items
- Retention policy: Approved KB artifacts remain; rejected runs archived for 90 days

Quick run & test commands:
- Run KB ingest: `POST http://localhost:8005/process?mode=KB` or `pwsh ops/smoke_ingest.ps1 -BatchName <name> -Mode KB`
- Run KB mode test: `npx playwright test ops/tests/kb_ingest_mode.spec.ts`

Contact for questions: ops@your-org.local

---

# KB_INGEST State Machine (developer-ready, concise)

States:
- DETECTED → ANALYZED → KB_REVIEW_REQUIRED → (KB_APPROVED | KB_REJECTED | LEGAL_REVIEW) → ARCHIVED

Key invariants:
- Files in KB mode are never auto-routed
- AI output is informational: `ai_summary` is an Array, `confidence` is an integer percent 0-100, `risk_flags` is a deduped array
- Approval requires human POST to `/approval` with schema-validated payload

API examples:
- POST /process?mode=KB → { runId, state: 'DETECTED' }
- GET /presenter/generated/presenter.json → includes `kb_mode` and `kb_banner` when in KB mode
- POST /approval { reviewer, status: 'approved'|'rejected', snapshot_id, items, timestamp } → enforces moves

Audit & Governance:
- All transitions include userId and notes
- Sensitive content must be escalated and locked until legal signoff

---

(End of SOP & state machine spec)
