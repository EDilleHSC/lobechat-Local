Add repository-root compliance guard (informational)

This PR adds:
- `README_COMPLIANCE.md` (repo-level allow-list for the compliance check)
- Guidance and examples of allowed root items

Why:
- Prevents accidental files being added to repo root and provides an audit trail for infra/config artifacts.
- Starts as informational to collect signal and reduce noise; will be marked as required after stabilization.

Notes:
- No deletions included; follow-up PRs will propose explicit cleanup where needed.
