# Release Notes — Approval Endpoint Hardening

## One-line changelog

- feat/approval-endpoint: Secure, auditable design approval system with schema validation, atomic file persistence, and CI-tested endpoint.

## Summary

This release hardens the design approval system:

- Enforces strict JSON schema validation for `POST /approval` using AJV (`schemas/approval.schema.json`).
- Adds negative tests (missing token, malformed JSON, invalid status enum) and integrates them into CI with a required `TEST_APPROVAL_TOKEN` secret.
- Ensures safe file writes via atomic tmp -> rename semantics and appends a human-readable `audit.log` with rotation.
- Documents operator usage and CI/ops guidance in `docs/OPERATOR_CHECKLIST.md` and provides an example approval JSON in `docs/examples/approval.example.json`.

## Deployment Notes

- Add repository secret `TEST_APPROVAL_TOKEN` used by CI to run integration & negative tests.
- Ensure `MCP_APPROVAL_TOKEN` is configured on operator-facing instances where approvals are accepted.

## Ops Recommendations

- Retain approval files for 90 days, archive weekly to secure object storage (S3 or equivalent) and keep audit logs for at least 1 year.
- Monitor `NAVI/approvals/` growth and alert on unexpected increases.
