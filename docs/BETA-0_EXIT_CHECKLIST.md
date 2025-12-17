BETA-0 Exit Checklist (working list)

Status: In progress — reinforced on 2025-12-17 where noted

- [x] Mailroom filesystem invariant enforced — verified 2025-12-17
  - Description: Mailroom aborts with `MAILROOM_INVARIANT` and exit code `2` when a file exists where a directory is expected. Tests added (pytest) to prevent regressions.
  - Validation: Manual smoke test run against `main` (created a file at `NAVI/REFERENCE` and confirmed immediate abort with no file movement).

- [ ] Ensure Process_Inbox batch shim exists on `main` or document canonical invocation
  - Description: `Process_Inbox.bat` convenience shim is missing from `main`; restore a root shim that runs the canonical entrypoint, or document `python core/intake/.../mailroom_runner.py` as the canonical invocation.
  - Owner: TBD
  - Priority: High (operational discoverability)

- [ ] Clara trust loop: verify deterministic presenter generation and timestamping
  - Owner: TBD

- [x] Formal Beta-0 freeze checklist & signoff — **frozen and tagged**
  - Owner: CTO
  - Tag: `v0.1.0-beta0` (2025-12-17)
  - Notes: Beta-0 intake, mailroom invariants, and entrypoints verified and documented on `main`
