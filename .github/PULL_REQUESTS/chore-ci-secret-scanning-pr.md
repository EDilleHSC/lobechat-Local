## Summary

This PR adds basic automated secret scanning to the repo CI and documents how to respond to detected secrets.

### Changes

- Added `secret-scan.yml` GitHub Actions workflow:
  - Runs on push, PR, and weekly schedule.
  - Uses `zricethezav/gitleaks-action` with a repo-local `.gitleaks.toml`.
- Added a starter `.gitleaks.toml` config:
  - Includes a rule for private key patterns.
  - Allowlist section for test fixture paths (can be tuned as needed).
- (Optional) Added `.pre-commit-config.yaml` with `detect-secrets` hook support.
- Added `REMEDIATION.md` documenting:
  - How to rotate leaked secrets.
  - How to remove them from the repo and (if needed) history.
  - Coordination/communication expectations.

### How to use

- CI: All pushes and PRs will run `gitleaks`; any leaks will fail the job.
- Local (optional): Install `pre-commit` and run:
  ```bash
  pre-commit install
  pre-commit run --all-files
  ```

### Reviewer checklist
- Skim `secret-scan.yml` triggers & gitleaks config.
- Confirm `.gitleaks.toml` is not overly broad for current repo.
- Skim `REMEDIATION.md` for clarity and completeness.
