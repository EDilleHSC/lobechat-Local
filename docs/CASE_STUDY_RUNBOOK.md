Trust Routing — One‑Page Case Study Runbook

Opening (30s)
- Say: “This is not a demo of automation. This is a demonstration of trust. Every step you see is observable, verifiable, and fails loudly if trust cannot be proven.”
- Show: repo/runtime running + CI badge

Step 1 — Human Input (Trust Origin)
- Say: “All trust begins with a human action. No black boxes.”
- Do: `echo "case study" > NAVI/inbox/case_study_input.txt`
- Show: `ls NAVI/inbox` (verify file present)
- Callout: No processing yet

Step 2 — Snapshot Creation (Immutability)
- Say: “The system immediately creates an immutable snapshot. From this point on, we never ‘forget’ what we saw.”
- Show: newest snapshot `ls -t NAVI/snapshots/inbox | head -n1` and `cat` the JSON
- Highlight: `snapshot_id`, `timestamp`, `items`
- Fallback: if missing, POST /process: `curl -X POST http://localhost:8005/process` and show logs

Step 3 — Mailroom + Router (Trust-Carrying Action)
- Say: “Routing happens only after trust is established. The system records where the file goes and why.”
- Show logs: `[MAILROOM]` output and `[ROUTER] Wrote meta...` & `[ROUTER] Completed...`
- Show agent inbox: `ls NAVI/agents/agent1/inbox` and open `<file>.meta.json`
- Read key fields: `routed_to`, `snapshot_id`, `checksum_sha256`, `trust_header`
- Fallback: run router fallback `node runtime/router.js` if meta missing

Step 4 — Presenter (Human Verification Surface)
- Say: “Automation stops here. The human sees exactly what the system believes to be true.”
- Show: open `NAVI/presenter/index.html` and point to `TRUST_HEADER`, `rendered_at`, `snapshot reference`, `mailroom_routed_to`
- If presenter doesn't update: re-run POST /process and show logs; fail loudly otherwise

Close (15s)
- Say: “This system is not fast by accident. It is slow on purpose where trust matters. Autonomy comes later. Trust comes first.”
- Final: “We do not trust outcomes. We trust processes that can be audited.”

Success Criteria (binary pass/fail)
- Snapshot created, TRUST_HEADER present, snapshot id matches across artifacts
- File appears in agent inbox with `<file>.meta.json` and `routed_to` correct
- Checksum validates
- Presenter updated with single TRUST_HEADER and timestamp
- Failure behavior: missing artifacts cause an explicit stop and log inspection

Post-Run Hardening Checklist
- Lock `TRUST_HEADER` schema version
- Add `receipt`/ack spec and record agent receipts
- Replace mailroom stub; add routing rules versioning
- Add quarantine path and monitoring
- Add CI smoke tests for receipts and negative cases

Conversion to PDF
- Recommended: open `docs/CASE_STUDY_RUNBOOK.md` in browser and print to PDF (fit to one page) or use:
  - Chrome: `chrome --headless --print-to-pdf=CASE_STUDY_RUNBOOK.pdf file:///<path>/docs/CASE_STUDY_RUNBOOK.html`
  - Pandoc (if installed): `pandoc docs/CASE_STUDY_RUNBOOK.md -o docs/CASE_STUDY_RUNBOOK.pdf --pdf-engine=wkhtmltopdf`

— End of runbook —
