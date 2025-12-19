## 🚀 v0.9.0-beta-day0-verified — Desk v1 Approval Loop Verified

**Release Date:** 2025-12-19  
**Tag:** `v0.9.0-beta-day0-verified`  
**Status:** ✅ Beta Approved – Desk v1 Flow Locked & Auditable

---

### 🧾 Summary

This release marks the successful completion of **Beta Day 0 system verification** for NAVI Mailroom / MCP Runtime in **Review Mode (Desk v1)**.

All critical systems required for human-in-the-loop approvals have been validated end-to-end, including:

- ✅ Manual file drops
- ✅ Explicit `/process` triggering
- ✅ Presenter UI review
- ✅ Token-gated approval flow
- ✅ Deterministic audit log + approval file write

**This tag captures the exact state used to complete and verify the first real approval loop.**

---

### 📁 What’s Included

- `scripts/test_beta_desk1.ps1` and `scripts/test_beta_desk1.sh`  
  – Deterministic test flow for review + approval + audit validation
- Updated PowerShell + Bash helper scripts with token handling
- Approval system hardened (schema-validated, token-secured, safe-fail)
- CI stability confirmed
- `README_BETA0.md` and `README_OPERATOR_BETA0.md` finalized for operator instructions

---

### 🧪 Verified Acceptance Test Output

- ✅ Snapshot created via `/process`
- ✅ Approval submitted with valid token
- ✅ `.approval.json` file written
- ✅ `audit.log` updated with correct operator metadata
- ✅ Sample files removed post-run

---

### 🛡️ Operating Mode

- Mode: **Review Only**
- Autonomy: ❌ Disabled
- Background Actions: ❌ None
- Audit: ✅ Enforced

---

### ✅ Use This Tag To:

- Run regression-safe operator sessions
- Validate approval systems in CI or local
- Launch real file-based testing with confidence

---

If you'd like, I can also create a GitHub Release draft using this body and tag metadata.
