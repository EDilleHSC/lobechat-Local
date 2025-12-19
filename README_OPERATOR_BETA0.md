# 📋 Operator Guide – Beta Day 0 (Desk v1 Review Flow)

**System:** NAVI Mailroom (Beta – Desk v1)
**Mode:** Human-in-the-Loop
**Date:** 2025-12-19
**Version:** `v0.9.0-beta-day0-verified`

---

## ✅ TL;DR — Operator Flow

1. Start the system with a valid approval token:

```powershell
./scripts/run_operator_flow.ps1 -Token YOUR_TOKEN_HERE
```

2. Drop 3–10 real files into:

```
NAVI/inbox/
```

3. Trigger processing:

```bash
curl -X POST http://localhost:8005/process
```

4. Review output in the presenter UI (browser):

```
http://localhost:8005/presenter/index.html
```

5. Submit approval via the Design Approval UI (or POST /approval with `X-MCP-APPROVAL-TOKEN` header)

6. Confirm:

- `.approval.json` created in `NAVI/approvals/YYYY-MM-DD/`
- `NAVI/approvals/audit.log` appended
- Snapshot ID recorded for traceability

---

## 🧠 Key Reminders

- You are in **Review Mode** — no background automation or file movement
- The system will **not** approve anything without you
- **Server must be started with `MCP_APPROVAL_TOKEN` in the server environment**, not just your shell
- If anything is unclear — pause, record the snapshot ID, and report it

---

## 🆘 Need Help?

- Reference: `README_BETA0.md`
- Re-run acceptance flow: `scripts/test_beta_desk1.ps1` (PowerShell) or `scripts/test_beta_desk1.sh` (Bash)
- Ask: `#ops-beta-test` channel or your test coordinator

---

**Reminder:** Confusion or friction is considered signal, not failure. Take notes, flag it. You’re helping make this bulletproof.
